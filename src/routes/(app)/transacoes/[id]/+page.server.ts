import { and, eq, isNull, ne } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import {
	createRecurringExpense,
	getActiveRecurringExpenseByDescription,
	updateRecurringExpense
} from '$lib/server/db/recurring-expenses';
import { deleteRuleForDescription } from '$lib/server/db/categorization-rules';
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

	// Drives the recurrence card's state. Because it matches on description, the
	// card reads "already created" on every transaction sharing that
	// description — which is the point: the recurrence describes the charge, not
	// this one occurrence of it.
	const recurrence = await getActiveRecurringExpenseByDescription(
		db,
		locals.userId,
		tx.description
	);

	return {
		recurrence: recurrence
			? {
					id: recurrence.id,
					frequency: recurrence.frequency,
					amount: recurrence.amount,
					createdAt: recurrence.createdAt
				}
			: null,
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
		// `fail` rather than a bare `{ error }`: the form only surfaces the
		// message when result.type is 'failure', and a plain return counts as a
		// success — so the card announced "Recorrência criada." for a rejected
		// submit.
		if (!validFrequencies.includes(frequency)) {
			return fail(400, { error: 'Frequência inválida.' });
		}

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		// Nothing stopped this from running twice — the card kept offering the
		// form after a successful submit, so a second click minted a duplicate
		// recurrence for the same description.
		const existing = await getActiveRecurringExpenseByDescription(
			db,
			locals.userId,
			tx.description
		);
		if (existing)
			return fail(409, { error: 'Já existe uma recorrência ativa para esta descrição.' });

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

	// Deactivates the recurrence for this description (soft delete, so the
	// history of what was tracked survives). It is shared by every transaction
	// with that description, which the card says out loud before offering this.
	removeRecurrence: async ({ locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		const existing = await getActiveRecurringExpenseByDescription(
			db,
			locals.userId,
			tx.description
		);
		if (!existing) return fail(404, { error: 'Nenhuma recorrência ativa para esta descrição.' });

		await updateRecurringExpense(db, locals.userId, existing.id, { isActive: false });
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

		// The rule goes with it. Clearing only the transaction left the rule that
		// had been created alongside it, and the next sync re-applied the same
		// category — so "Remover" could not actually lead to re-categorising.
		await deleteRuleForDescription(db, locals.userId, tx.description);

		return { success: true };
	}
};
