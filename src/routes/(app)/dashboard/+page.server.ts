import { redirect } from '@sveltejs/kit';
import { and, desc, eq, gte, isNull, lt, lte, notInArray, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getLatestMonthlyReport } from '$lib/server/db/monthly-reports';
import { financeAccounts as accounts, transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import {
	INTERNAL_TRANSFER_CATEGORIES,
	INTERNAL_TRANSFER_DESCRIPTIONS
} from '$lib/server/pluggy/internal-transfers';

function startOfMonth(offset = 0): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

// Internal transfers and investment movements are neither spending nor income —
// filtered out of every dashboard summary query. Beyond the API's category, the
// description is filtered too ("Pagamento de fatura" arrives with the generic
// "Transfers" category on the checking account, but is internal movement).
const isNotInternalTransfer = and(
	notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES]),
	notInArray(transactions.description, [...INTERNAL_TRANSFER_DESCRIPTIONS])
);

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	// Credenciais são OPCIONAIS.
	const [aiCredentials, pluggyCredentials] = await Promise.all([
		getAiCredentials(db, userId),
		getPluggyCredentials(db, userId)
	]);

	const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));

	// Tipo de conta por id — o cartão de crédito tem lógica própria (ver
	// INTERNAL_TRANSFER_CATEGORIES e o tratamento de sinal no loop abaixo).
	const accountTypeById = new Map(userAccounts.map((a) => [a.id, a.type]));

	// "Recent" means up to today: an invoice transaction dated in the future (an
	// instalment yet to land) is not recent, even if the bank sent it earlier.
	const now = new Date();
	const recentTransactions = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
				isNotInternalTransfer,
				lte(transactions.date, now)
			)
		)
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
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
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
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
				isNotInternalTransfer,
				gte(transactions.date, monthStartPrev),
				lt(transactions.date, monthStart)
			)
		);

	let monthIncome = 0;
	let monthExpense = 0;
	const categoryTotals: Record<string, number> = {};
	for (const tx of monthTransactions) {
		const accType = tx.accountId ? accountTypeById.get(tx.accountId) : undefined;

		if (accType === 'credit_card') {
			// Credit card: a purchase (positive) is SPENDING, not income. The invoice
			// payment is already filtered by isNotInternalTransfer (the "Credit card
			// payment" category).
			if (tx.amount > 0) {
				monthExpense += tx.amount;
				const cat = tx.category ?? 'Outros';
				categoryTotals[cat] = (categoryTotals[cat] ?? 0) + tx.amount;
			}
			continue;
		}

		if (tx.amount >= 0) {
			monthIncome += tx.amount;
		} else {
			const abs = Math.abs(tx.amount);
			monthExpense += abs;
			const cat = tx.category ?? 'Outros';
			categoryTotals[cat] = (categoryTotals[cat] ?? 0) + abs;
		}
	}

	let prevExpense = 0;
	for (const tx of prevMonthTransactions) {
		const accType = tx.accountId ? accountTypeById.get(tx.accountId) : undefined;
		if (accType === 'credit_card') {
			if (tx.amount > 0) prevExpense += tx.amount;
			continue;
		}
		if (tx.amount < 0) prevExpense += Math.abs(tx.amount);
	}

	const investmentBalance = userAccounts
		.filter((a) => a.type === 'investment')
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	const checkingBalance = userAccounts
		.filter((a) => a.type === 'checking')
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	// Saldo total = patrimônio líquido: ativos (contas + investimentos) menos a
	// dívida do cartão de crédito (a fatura em aberto, que agrega as parcelas
	// futuras). O cartão NÃO é um ativo — é passivo.
	const creditCardBalance = userAccounts
		.filter((a) => a.type === 'credit_card')
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	const totalBalance = checkingBalance + investmentBalance - creditCardBalance;

	// The month's top 5 spending categories (only those above zero).
	const topCategories = Object.entries(categoryTotals)
		.filter(([, v]) => v > 0)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5)
		.map(([name, value]) => ({ name, value }));

	// Monthly balance trend (last 6 months) — summed per month.
	const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
	const monthlyData = await db
		.select({ yearMonth: sql`strftime('%Y-%m', date, 'unixepoch')`, amount: transactions.amount })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
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
			if (row.yearMonth === label) balance += row.amount;
		}
		monthValues.push(Math.round(balance * 100) / 100);
	}

	const latestReport = await getLatestMonthlyReport(db, userId);

	return {
		aiConfigured: Boolean(aiCredentials),
		aiProvider: aiCredentials?.provider ?? null,
		aiModel: aiCredentials?.model ?? null,
		pluggyConfigured: Boolean(pluggyCredentials),
		accounts: userAccounts,
		recentTransactions,
		summary: {
			totalBalance: Math.round(totalBalance * 100) / 100,
			checkingBalance: Math.round(checkingBalance * 100) / 100,
			investmentBalance: Math.round(investmentBalance * 100) / 100,
			monthIncome: Math.round(monthIncome * 100) / 100,
			monthExpense: Math.round(monthExpense * 100) / 100,
			prevExpense: Math.round(prevExpense * 100) / 100,
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
