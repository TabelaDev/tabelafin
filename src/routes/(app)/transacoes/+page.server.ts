import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, gte, inArray, isNull, lte, notInArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { financeAccounts as accounts, transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { upsertCategorizationRule } from '$lib/server/db/categorization-rules';
import {
	INTERNAL_TRANSFER_CATEGORIES,
	INTERNAL_TRANSFER_DESCRIPTIONS
} from '$lib/server/pluggy/internal-transfers';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	const category = url.searchParams.get('categoria');
	const month = url.searchParams.get('mes');
	const search = url.searchParams.get('q');
	const tipo = url.searchParams.get('tipo');

	const conditions = [
		eq(transactions.userId, userId),
		isNull(transactions.supersededByTransactionId)
	];
	if (category) conditions.push(eq(transactions.category, category));

	// Filtro de tipo (receitas/despesas) aplica a MESMA lógica do dashboard:
	// exclui transferência interna e trata compra de cartão (positiva) como
	// gasto. Assim a lista bate com os cards de resumo pra validar os números.
	if (tipo === 'receitas' || tipo === 'despesas') {
		conditions.push(
			notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES]),
			notInArray(transactions.description, [...INTERNAL_TRANSFER_DESCRIPTIONS])
		);
	}

	let rows;
	if (month && /^\d{4}-\d{2}$/.test(month)) {
		const [y, m] = month.split('-').map(Number);
		const from = new Date(y, m - 1, 1);
		const to = new Date(y, m, 1);
		rows = await db
			.select()
			.from(transactions)
			.where(and(...conditions, gte(transactions.date, from), lte(transactions.date, to)))
			.orderBy(desc(transactions.date));
	} else {
		rows = await db
			.select()
			.from(transactions)
			.where(and(...conditions))
			.orderBy(desc(transactions.date));
	}

	// O filtro de sinal depende do tipo da conta (cartão tem sinal invertido),
	// então precisa do tipo de cada conta pra filtrar em memória.
	const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
	const accountTypeById = new Map(userAccounts.map((a) => [a.id, a.type]));

	// On a credit card the API reports a purchase as positive and a refund as
	// negative — the opposite of a checking account. "receitas" used to reject
	// every card row outright while "despesas" kept only the positive ones, so a
	// card refund matched neither filter and existed only in the unfiltered view.
	if (tipo === 'receitas') {
		rows = rows.filter((t) => {
			const accType = t.accountId ? accountTypeById.get(t.accountId) : undefined;
			if (accType === 'credit_card') return t.amount < 0; // estorno
			return t.amount >= 0;
		});
	} else if (tipo === 'despesas') {
		rows = rows.filter((t) => {
			const accType = t.accountId ? accountTypeById.get(t.accountId) : undefined;
			if (accType === 'credit_card') return t.amount > 0; // compra
			return t.amount < 0;
		});
	}

	if (search) {
		const q = search.toLowerCase();
		rows = rows.filter((t) => t.description.toLowerCase().includes(q));
	}

	// Lançamentos futuros (ex.: parcelas de cartão que o Nubank pré-lança com
	// data de fatura à frente) ficam numa lista à parte, como o app do Nubank
	// mostra "próximas faturas". A lista principal só mostra data <= hoje.
	const now = new Date();
	const future = rows.filter((t) => t.date.getTime() > now.getTime());
	const current = rows.filter((t) => t.date.getTime() <= now.getTime());

	// Nome da conta pra agrupar as próximas faturas por cartão.
	const accountById = new Map(userAccounts.map((a) => [a.id, a]));

	// Pra exibição, inverte o sinal das compras de cartão de crédito: na API
	// elas vêm positivas (ex.: "MP *NAVE" +782,54), mas representam GASTO.
	// Assim a cor (verde=receita/vermelho=gasto) e o total ficam consistentes
	// com o dashboard.
	const withDisplayAmount = (tx: (typeof current)[number]) => {
		const accType = tx.accountId ? accountTypeById.get(tx.accountId) : undefined;
		// Pra exibição, inverte o sinal das transações de cartão de crédito:
		// na API compras vêm positivas (ex.: "MP *NAVE" +782,54 = gasto) e
		// estornos vêm negativos (ex.: "Estorno de Uber" -1,44 = dinheiro de
		// volta). Invertendo sempre, compra fica negativa (vermelho) e estorno
		// fica positivo (verde) — consistente com o dashboard.
		const displayAmount = accType === 'credit_card' ? -tx.amount : tx.amount;
		return { ...tx, displayAmount };
	};

	// Categorias do usuário (nome + cor) — usadas nos badges e no filtro.
	const userCategories = await getCategoriesByUser(db, userId);

	return {
		transactions: current.map(withDisplayAmount),
		future: future.map((tx) => ({
			...withDisplayAmount(tx),
			accountName: tx.accountId ? (accountById.get(tx.accountId)?.name ?? null) : null
		})),
		categories: userCategories,
		filters: { category, month, search, tipo }
	};
};

export const actions: Actions = {
	// Categorização em massa: recebe uma lista de ids de transações (marcadas
	// na tabela) + categoria e aplica em todas. Valida a pertença ao usuário
	// e nunca sobrescreve categorias escolhidas manualmente (categorySource
	// 'user' já existentes ficam como estão — aqui só as que ainda não têm
	// categoria manual são tocadas).
	bulkCategorize: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const idsRaw = String(form.get('ids') ?? '');
		const category = String(form.get('category') ?? '').trim();

		const ids = idsRaw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { error: 'Selecione pelo menos uma transação.' });
		if (!category) return fail(400, { error: 'Selecione uma categoria.' });

		const db = getDb(platform!.env.DB);

		// Busca as transações selecionadas pra validar pertença e não tocar em
		// categorias manuais existentes.
		const rows = await db
			.select({
				id: transactions.id,
				categorySource: transactions.categorySource,
				description: transactions.description
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, locals.userId),
					inArray(transactions.id, ids),
					isNull(transactions.supersededByTransactionId)
				)
			);

		if (rows.length === 0) return fail(400, { error: 'Nenhuma transação válida encontrada.' });

		// Picking categories by hand is a user decision, exactly like doing it one
		// at a time on the detail page — so it is stored as 'user' and protected
		// from later passes. It used to be written as 'rule', which both mislabelled
		// it ("Categorizada por: Regra automática") and left it open to being
		// overwritten by the next bulk action.
		const toUpdate = rows.filter((r) => r.categorySource !== 'user').map((r) => r.id);

		if (toUpdate.length > 0) {
			await db
				.update(transactions)
				.set({ category, categorySource: 'user' })
				.where(inArray(transactions.id, toUpdate));
		}

		// ...and the rule really is created, once per distinct description. The
		// card promises "transações futuras com a mesma descrição já entram
		// categorizadas", and in bulk that promise was not being kept: nothing
		// called upsertCategorizationRule, so the next Uber charge still arrived
		// uncategorised.
		const descriptions = [...new Set(rows.map((r) => r.description))];
		for (const description of descriptions) {
			await upsertCategorizationRule(db, locals.userId, description, category);
		}

		return { success: true, count: toUpdate.length };
	}
};
