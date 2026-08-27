import { AccountType } from '$lib/enums/account-type';
import { getDb } from '$lib/server/db';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { transactions } from '$lib/server/db/schema';
import {
	classifyMovement,
	isNotInternalTransfer,
	visibleTransactions
} from '$lib/server/db/transactions';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { requireLogin } from '$lib/server/require-login';

import { and } from 'drizzle-orm';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	// The user's own categories — the per-category total is computed below.
	const userCategories = await getCategoriesByUser(db, userId);

	// Account type by id: needed to classify spending/income — a credit card
	// purchase comes in positive but is SPENDING, not income (classifyMovement).
	const userAccounts = await getAccountsByUser(db, userId);
	const accountTypeById = new Map(userAccounts.map((a) => [a.id, a.type as AccountType]));

	// All-time movement per category, excluding internal transfers and investment
	// movements — those are neither spending nor income (a card invoice payment
	// would otherwise double-count the card purchases). Same predicate the
	// dashboard and transactions use.
	const rows = await db
		.select({
			category: transactions.category,
			amount: transactions.amount,
			accountId: transactions.accountId
		})
		.from(transactions)
		.where(and(visibleTransactions(userId), isNotInternalTransfer));

	const expenses: Record<string, number> = {};
	const income: Record<string, number> = {};
	for (const r of rows) {
		const cat = r.category ?? 'Outros';
		const { expense, income: inc } = classifyMovement(
			r.accountId ? accountTypeById.get(r.accountId) : undefined,
			r.amount
		);
		expenses[cat] = (expenses[cat] ?? 0) + expense;
		income[cat] = (income[cat] ?? 0) + inc;
	}

	// Lists the user's categories with their totals; "Outros" (uncategorised
	// movement) goes last when it has a value.
	const categories = userCategories
		.map((c) => ({
			name: c.name,
			color: c.color,
			expense: expenses[c.name] ?? 0,
			income: income[c.name] ?? 0
		}))
		.sort((a, b) => Math.max(b.expense, b.income) - Math.max(a.expense, a.income));

	if (!userCategories.some((c) => c.name === 'Outros')) {
		categories.push({
			name: 'Outros',
			color: 'ctp-overlay1',
			expense: expenses['Outros'] ?? 0,
			income: income['Outros'] ?? 0
		});
	}

	return { categories };
};
