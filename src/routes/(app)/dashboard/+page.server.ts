import { AccountType } from '$lib/enums/account-type';
import { PluggyStatus } from '$lib/enums/pluggy-status';
import { getDb } from '$lib/server/db';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getLatestMonthlyReport } from '$lib/server/db/monthly-reports';
import { transactions } from '$lib/server/db/schema';
import {
	classifyMovement,
	isNotInternalTransfer,
	summarizeTransactions,
	visibleTransactions
} from '$lib/server/db/transactions';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { requireLogin } from '$lib/server/require-login';
import { getPluggyStatus } from '$lib/server/services/pluggy-status.service';

import { and, desc, gte, lt, lte, sql } from 'drizzle-orm';

import type { PageServerLoad } from './$types';

function startOfMonth(offset = 0): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	// Credentials are OPTIONAL.
	const [aiCredentials, pluggyStatus] = await Promise.all([
		getAiCredentials(db, userId),
		getPluggyStatus(db, userId)
	]);

	const userAccounts = await getAccountsByUser(db, userId);

	// Account type by id — the credit card has its own logic (see
	// INTERNAL_TRANSFER_CATEGORIES and the sign handling in the loop below).
	const accountTypeById = new Map(userAccounts.map((a) => [a.id, a.type as AccountType]));

	// "Recent" means up to today: an invoice transaction dated in the future (an
	// instalment yet to land) is not recent, even if the bank sent it earlier.
	const now = new Date();
	const recentTransactions = await db
		.select()
		.from(transactions)
		.where(and(visibleTransactions(userId), isNotInternalTransfer, lte(transactions.date, now)))
		.orderBy(desc(transactions.date))
		.limit(10);

	// Current-month data for the summary cards and charts. Bounded to the month on
	// purpose: the credit card posts instalments dated in the future ("Nave 12/12"
	// in 2027-01) which are NOT this month's spending — only the ones due now.
	const monthStart = startOfMonth(0);
	const monthEnd = startOfMonth(1);
	const monthStartPrev = startOfMonth(-1);
	const monthTransactions = await db
		.select()
		.from(transactions)
		.where(
			and(
				visibleTransactions(userId),
				isNotInternalTransfer,
				gte(transactions.date, monthStart),
				lt(transactions.date, monthEnd)
			)
		);

	const prevMonthTransactions = await db
		.select()
		.from(transactions)
		.where(
			and(
				visibleTransactions(userId),
				isNotInternalTransfer,
				gte(transactions.date, monthStartPrev),
				lt(transactions.date, monthStart)
			)
		);

	const {
		income: monthIncome,
		expense: monthExpense,
		categoryTotals
	} = summarizeTransactions(monthTransactions, accountTypeById);

	const { expense: prevExpense } = summarizeTransactions(prevMonthTransactions, accountTypeById);

	const investmentBalance = userAccounts
		.filter((a) => a.type === AccountType.Investment)
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	const checkingBalance = userAccounts
		.filter((a) => a.type === AccountType.Checking)
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	// Total balance = net worth: assets (accounts + investments) minus the
	// credit card debt (the open invoice, which aggregates future instalments).
	// The card is NOT an asset — it is a liability.
	const creditCardBalance = userAccounts
		.filter((a) => a.type === AccountType.CreditCard)
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	const totalBalance = checkingBalance + investmentBalance - creditCardBalance;

	// The month's top 5 spending categories (only those above zero).
	const topCategories = Object.entries(categoryTotals)
		.filter(([, v]) => v > 0)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5)
		.map(([name, value]) => ({ name, value }));

	// Monthly balance trend (last 6 months) — summed per month.
	//
	// `accountId` comes along so the sign can be normalised per account type: on a
	// credit card a positive amount is a *purchase*, not income. Summing the raw
	// column (as this did) made a month of card spending show up as a positive
	// bar, contradicting the "Gastos do mês" card right above the chart.
	const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
	const monthlyData = await db
		.select({
			yearMonth: sql<string>`strftime('%Y-%m', date, 'unixepoch')`,
			amount: transactions.amount,
			accountId: transactions.accountId
		})
		.from(transactions)
		.where(
			and(
				visibleTransactions(userId),
				isNotInternalTransfer,
				gte(transactions.date, sixMonthsAgo),
				lt(transactions.date, monthEnd)
			)
		);

	const monthLabels: string[] = [];
	const monthValues: number[] = [];
	for (let i = 5; i >= 0; i--) {
		const d = startOfMonth(-i);
		const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		monthLabels.push(d.toLocaleDateString('pt-BR', { month: 'short' }));
		let balance = 0;
		for (const row of monthlyData) {
			if (row.yearMonth !== label) continue;
			const { income, expense } = classifyMovement(
				row.accountId ? accountTypeById.get(row.accountId) : undefined,
				row.amount
			);
			// Net for the month: what came in minus what went out.
			balance += income - expense;
		}
		monthValues.push(balance);
	}

	const latestReport = await getLatestMonthlyReport(db, userId);

	return {
		aiConfigured: Boolean(aiCredentials),
		aiProvider: aiCredentials?.provider ?? null,
		aiModel: aiCredentials?.model ?? null,
		pluggyConfigured: pluggyStatus !== PluggyStatus.Disconnected,
		accounts: userAccounts,
		recentTransactions,
		summary: {
			totalBalance: totalBalance,
			checkingBalance: checkingBalance,
			investmentBalance: investmentBalance,
			monthIncome: monthIncome,
			monthExpense: monthExpense,
			prevExpense: prevExpense,
			categoryTotals,
			topCategories,
			monthLabels,
			monthValues
		},
		categories: await getCategoriesByUser(db, userId),
		vapidPublicKey: platform!.env.VAPID_PUBLIC_KEY,
		latestReport: latestReport
			? {
					yearMonth: latestReport.yearMonth,
					summary: JSON.parse(latestReport.summaryJson)
				}
			: null
	};
};
