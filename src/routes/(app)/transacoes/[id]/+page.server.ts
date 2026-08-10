import { and, eq, isNull, ne } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { createRecurringExpense } from '$lib/server/db/recurring-expenses';
import { upsertCategorizationRule } from '$lib/server/db/categorization-rules';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);

	const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
	if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

	const account = tx.accountId
		? await db
				.select()
				.from(financeAccounts)
				.where(eq(financeAccounts.id, tx.accountId))
				.then((r) => r[0] ?? null)
		: null;

	const categories = await getCategoriesByUser(db, locals.userId);

	return {
		transaction: {
			...tx,
			// Pra exibição, inverte o sinal das transações de cartão de crédito:
			// compra positiva na API = gasto (mostra negativo); estorno negativo
			// na API = dinheiro de volta (mostra positivo). Inverte sempre.
			displayAmount: account?.type === 'credit_card' ? -tx.amount : tx.amount
		},
		account: account
			? { name: account.name, institution: account.institution, type: account.type }
			: null,
		categories
	};
};

export const actions: Actions = {
	categorize: async ({ request, locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const category = String(form.get('category') ?? '').trim();
		if (!category) return { error: 'Selecione uma categoria.' };

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		// Categoria escolhida manualmente — nunca é sobrescrita por IA/regras.
		await db
			.update(transactions)
			.set({ category, categorySource: 'user' })
			.where(eq(transactions.id, tx.id));

		// Retroativamente, aplica a mesma categoria a TODAS as transações
		// passadas com a MESMA descrição que ainda estão sem categoria — o
		// usuário ensinou o app e espera consistência no histórico (ex.:
		// "Psicólogo" pra todas as consultas). A transação atual já foi setada
		// como 'user'; as demais ficam como 'rule'.
		await db
			.update(transactions)
			.set({ category, categorySource: 'rule' })
			.where(
				and(
					eq(transactions.userId, locals.userId),
					eq(transactions.description, tx.description),
					isNull(transactions.category),
					ne(transactions.id, tx.id)
				)
			);

		// Cria a regra automática: toda transação futura com a MESMA descrição
		// nasce categorizada (aplicada no sync, categorySource='rule').
		await upsertCategorizationRule(db, locals.userId, tx.description, category);

		return { success: true };
	},

	// Converte a transação em recorrência: cria um gasto recorrente com a
	// mesma descrição, valor absoluto e categoria. A frequência vem do form
	// (default mensal).
	recurring: async ({ request, locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const frequency = String(form.get('frequency') ?? 'monthly');
		const nextChargeDate = form.get('nextChargeDate');
		const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly'];
		if (!validFrequencies.includes(frequency)) {
			return { error: 'Frequência inválida.' };
		}

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		// Valor absoluto (recorrência é sempre um gasto/saída fixa).
		const amount = Math.abs(tx.amount);

		await createRecurringExpense(db, locals.userId, {
			description: tx.description,
			amount,
			category: tx.category ?? undefined,
			frequency: frequency as 'monthly' | 'yearly' | 'weekly' | 'quarterly',
			nextChargeDate:
				typeof nextChargeDate === 'string' && nextChargeDate ? new Date(nextChargeDate) : undefined
		});

		return { success: true };
	},

	// Remove a categoria da transação (fica sem categoria de novo). Usado pelo
	// card de categorizar quando o usuário quer re-categorizar — precisa limpar
	// antes de escolher outra.
	removeCategory: async ({ locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		await db
			.update(transactions)
			.set({ category: null, categorySource: null })
			.where(eq(transactions.id, tx.id));

		return { success: true };
	}
};
