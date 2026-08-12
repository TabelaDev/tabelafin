import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { upsertCategorizationRule } from '$lib/server/db/categorization-rules';
import { isNotInternalTransfer, visibleTransactions } from '$lib/server/db/transactions';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	const category = url.searchParams.get('category');
	const month = url.searchParams.get('month');
	const search = url.searchParams.get('q');
	const type = url.searchParams.get('type');
	// Internal transfers (moving your own money: paying the card invoice,
	// investing, transferring between own accounts) are hidden by default, the
	// same as on the dashboard. This list used to include them while the
	// dashboard did not, so the two never agreed on what a month cost.
	const showInternal = url.searchParams.get('internal') === 'yes';

	const conditions = [visibleTransactions(userId)];
	if (category) conditions.push(eq(transactions.category, category));

	// The type filter (income/expenses) applies the SAME logic as the dashboard: it
	// excludes internal transfers and treats a card purchase (positive) as
	// spending. That is what makes this list reconcile with the summary cards.
	//
	// The type filter keeps excluding them even when the toggle is on: it exists
	// precisely so the totals reconcile with the dashboard cards, and honouring
	// the toggle there would quietly break that promise.
	const isTypeFiltered = type === 'income' || type === 'expenses';
	if (!showInternal || isTypeFiltered) {
		conditions.push(isNotInternalTransfer);
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

	// The sign filter depends on the account type (a card's sign is inverted), so
	// each account's type is needed to filter in memory.
	const userAccounts = await getAccountsByUser(db, userId);
	const accountTypeById = new Map(userAccounts.map((a) => [a.id, a.type]));

	// On a credit card the API reports a purchase as positive and a refund as
	// negative — the opposite of a checking account. "receitas" used to reject
	// every card row outright while "despesas" kept only the positive ones, so a
	// card refund matched neither filter and existed only in the unfiltered view.
	if (type === 'income') {
		rows = rows.filter((t) => {
			const accType = t.accountId ? accountTypeById.get(t.accountId) : undefined;
			if (accType === 'credit_card') return t.amount < 0; // estorno
			return t.amount >= 0;
		});
	} else if (type === 'expenses') {
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

	// Future entries (card instalments Nubank posts ahead of time, dated to the
	// invoice) live in a separate list, the way the Nubank app shows "próximas
	// faturas". The main list only shows dates up to today.
	const now = new Date();
	const future = rows.filter((t) => t.date.getTime() > now.getTime());
	const current = rows.filter((t) => t.date.getTime() <= now.getTime());

	// The account name, for grouping the upcoming invoices by card.
	const accountById = new Map(userAccounts.map((a) => [a.id, a]));

	// For display, credit card purchases have their sign flipped: the API reports
	// them positive ("MP *NAVE" +782,54) but they are SPENDING. Flipping keeps the
	// colour (green=income/red=spending) and the total consistent with the
	// dashboard.
	const withDisplayAmount = (tx: (typeof current)[number]) => {
		const accType = tx.accountId ? accountTypeById.get(tx.accountId) : undefined;
		// For display, credit card transactions have their sign flipped: the API
		// reports purchases positive ("MP *NAVE" +782,54 = spending) and refunds
		// negative ("Estorno de Uber" -1,44 = money back). Flipping unconditionally
		// makes a purchase negative (red) and a refund positive (green) —
		// consistent with the dashboard.
		const displayAmount = accType === 'credit_card' ? -tx.amount : tx.amount;
		return { ...tx, displayAmount };
	};

	// The user's categories (name + colour) — used by the badges and the filter.
	const userCategories = await getCategoriesByUser(db, userId);

	return {
		transactions: current.map(withDisplayAmount),
		future: future.map((tx) => ({
			...withDisplayAmount(tx),
			accountName: tx.accountId ? (accountById.get(tx.accountId)?.name ?? null) : null
		})),
		categories: userCategories,
		filters: { category, month, search, type, internal: showInternal ? 'yes' : '' }
	};
};

export const actions: Actions = {
	// Bulk categorisation: takes a list of transaction ids (ticked in the table)
	// plus a category and applies it to all of them. It checks ownership and never
	// overwrites a hand-picked category (existing categorySource 'user' rows are
	// left alone — only those without a manual category are touched).
	//
	// `create_rules=yes` adds the automatic rules on top; without it the action
	// only categorises the selected transactions and teaches the app nothing
	// about future ones.
	bulkCategorize: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const idsRaw = String(form.get('ids') ?? '');
		const category = String(form.get('category') ?? '').trim();
		// Creating rules is now an explicit choice, confirmed in a dialog before
		// the request goes out. It used to happen unconditionally, so a one-off
		// bulk tidy-up silently taught the app to categorise every future
		// transaction with those descriptions the same way.
		const createRules = form.get('create_rules') === 'yes';

		const ids = idsRaw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { error: 'Selecione pelo menos uma transação.' });
		if (!category) return fail(400, { error: 'Selecione uma categoria.' });

		const db = getDb(platform!.env.DB);

		// Loads the selected transactions to check ownership and to avoid touching
		// existing manual categories.
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
		const toUpdate = rows.filter((r) => r.categorySource !== 'user');

		if (toUpdate.length > 0) {
			await db
				.update(transactions)
				.set({ category, categorySource: 'user' })
				.where(
					inArray(
						transactions.id,
						toUpdate.map((r) => r.id)
					)
				);
		}

		// ...and the rule really is created, once per distinct description. The
		// card promises that future transactions with the same description arrive
		// already categorised, and in bulk that promise was not being kept: nothing
		// called upsertCategorizationRule, so the next Uber charge still arrived
		// uncategorised.
		//
		// Derived from `toUpdate`, not from every selected row: a row skipped for
		// already carrying a manual category keeps that category, so minting a
		// rule from its description would leave the rule contradicting the very
		// transaction it was read from.
		const descriptions = createRules ? [...new Set(toUpdate.map((r) => r.description))] : [];
		for (const description of descriptions) {
			await upsertCategorizationRule(db, locals.userId, description, category);
		}

		return { success: true, count: toUpdate.length, ruleCount: descriptions.length };
	}
};
