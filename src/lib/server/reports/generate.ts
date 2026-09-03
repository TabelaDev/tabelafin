// Monthly cron (the 1st, ESCOPO.md §3.6): writes the previous month's
// monthly_reports for every user and fires a push saying the report is ready.
import { AccountType } from '$lib/enums/account-type';
import { type CategoryTotals, generateMonthlySummary } from '$lib/server/ai/report';
import { decryptSecret } from '$lib/server/crypto';
import { getDb } from '$lib/server/db';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getMonthlyReport, insertMonthlyReport } from '$lib/server/db/monthly-reports';
import {
	deletePushSubscriptionById,
	findPushSubscriptionsByUserId
} from '$lib/server/db/push-subscriptions';
import { getTagTotals } from '$lib/server/db/tags';
import { getTransactionsInRange, summarizeTransactions } from '$lib/server/db/transactions';
import { getAllUsers } from '$lib/server/db/users';
import type { AiProvider } from '$lib/utils/ai-providers';

import { buildPushPayload } from '@block65/webcrypto-web-push';

type Db = ReturnType<typeof getDb>;

interface MonthRange {
	yearMonth: string; // 'YYYY-MM'
	from: Date;
	to: Date; // exclusive
}

// The month before the day the cron runs (the 1st of the current month, see
// `triggers.crons` in wrangler.jsonc) — in UTC, so it does not depend on the
// Worker runtime's time zone.
function previousMonthRange(now: Date): MonthRange {
	const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
	const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const yearMonth = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}`;
	return { yearMonth, from, to };
}

function previousYearMonth(yearMonth: string): string {
	const [year, month] = yearMonth.split('-').map(Number);
	const d = new Date(Date.UTC(year, month - 1 - 1, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface ReportSummary {
	totalIncome: number;
	totalExpense: number;
	categoryTotals: CategoryTotals;
	investmentBalance: number;
	narrative: string;
}

export async function generateMonthlyReports(env: Env): Promise<void> {
	const db = getDb(env.DB);
	const range = previousMonthRange(new Date());
	const users = await getAllUsers(db);

	for (const user of users) {
		// The narrative is written by the user's own AI key, so the toggle in
		// /profile/ai has to be honoured here — otherwise turning it off still
		// bills them every first of the month.
		if (!user.aiReportEnabled) continue;
		try {
			await generateReportForUser(db, env, user.id, range);
		} catch (err) {
			console.error('[reports/generate] falha ao gerar relatório', {
				userId: user.id,
				yearMonth: range.yearMonth,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}

async function generateReportForUser(
	db: Db,
	env: Env,
	userId: string,
	range: MonthRange
): Promise<void> {
	// Idempotent: if the cron runs again (retry or manual reprocessing),
	// it never generates the same report/push twice.
	const existing = await getMonthlyReport(db, userId, range.yearMonth);
	if (existing) return;

	const aiCredentials = await getAiCredentials(db, userId);
	if (!aiCredentials) {
		console.error('[reports/generate] usuário sem ai_credentials, pulando relatório', {
			userId,
			yearMonth: range.yearMonth
		});
		return;
	}

	const transactions = await getTransactionsInRange(db, userId, range.from, range.to);
	const accounts = await getAccountsByUser(db, userId);
	const accountTypeById = new Map(accounts.map((a) => [a.id, a.type as AccountType]));

	const {
		income: totalIncome,
		expense: totalExpense,
		categoryTotals
	} = summarizeTransactions(transactions, accountTypeById);
	const investmentBalance = accounts
		.filter((a) => a.type === AccountType.Investment)
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	// The previous month, when one exists, feeds the comparison asked for in
	// ESCOPO.md §3.5 ("month-on-month comparison") — read from the summaryJson
	// already stored, without recomputing it from the transactions.
	const previousReport = await getMonthlyReport(db, userId, previousYearMonth(range.yearMonth));
	const previousSummary = previousReport
		? (JSON.parse(previousReport.summaryJson) as ReportSummary)
		: null;

	const apiKey = await decryptSecret(
		env.MASTER_KEY,
		{
			ciphertext: aiCredentials.keyEncrypted,
			nonce: aiCredentials.nonce,
			v: aiCredentials.v ?? undefined
		},
		{ purpose: 'ai_credentials', userId }
	);

	const narrative = await generateMonthlySummary({
		provider: aiCredentials.provider as AiProvider,
		model: aiCredentials.model,
		apiKey,
		yearMonth: range.yearMonth,
		totalIncome,
		totalExpense,
		categoryTotals,
		investmentBalance,
		tagTotals: (await getTagTotals(db, userId, range.from, range.to)).map((t) => ({
			name: t.name,
			expense: t.expense
		})),
		previousMonth: previousSummary
			? {
					totalExpense: previousSummary.totalExpense,
					categoryTotals: previousSummary.categoryTotals
				}
			: null
	});

	const summary: ReportSummary = {
		totalIncome,
		totalExpense,
		categoryTotals,
		investmentBalance,
		narrative
	};

	await insertMonthlyReport(db, {
		userId,
		yearMonth: range.yearMonth,
		summaryJson: JSON.stringify(summary),
		modelUsed: aiCredentials.model
	});

	await sendReportReadyPush(db, env, userId, range.yearMonth);
}

async function sendReportReadyPush(
	db: Db,
	env: Env,
	userId: string,
	yearMonth: string
): Promise<void> {
	const subscriptions = await findPushSubscriptionsByUserId(db, userId);
	if (subscriptions.length === 0) return;

	const vapid = {
		subject: env.VAPID_SUBJECT,
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY
	};
	const message = {
		data: {
			title: 'Relatório mensal pronto',
			body: `Seu relatório de ${yearMonth} já está disponível no TAbelhaFin.`,
			url: '/dashboard'
		},
		options: { ttl: 1800 }
	};

	await Promise.all(
		subscriptions.map(async (sub) => {
			try {
				const payload = await buildPushPayload(
					message,
					{
						endpoint: sub.endpoint,
						expirationTime: null,
						keys: { p256dh: sub.p256dh, auth: sub.auth }
					},
					vapid
				);
				const res = await fetch(sub.endpoint, payload as RequestInit);
				// 404/410 = a dead subscription (uninstalled or revoked) — the same
				// cleanup TAbelhaCal does in server/push/reminders.ts.
				if (res.status === 404 || res.status === 410) {
					await deletePushSubscriptionById(db, sub.id);
				}
			} catch (err) {
				console.error('[reports/generate] falha ao enviar push', {
					userId,
					subscriptionId: sub.id,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		})
	);
}
