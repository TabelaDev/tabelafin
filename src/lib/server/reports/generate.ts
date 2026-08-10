// Cron mensal (dia 1, ESCOPO.md §3.6): gera monthly_reports do mês anterior
// pra cada usuário e dispara push avisando que o relatório está pronto.
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { getDb } from '$lib/server/db';
import { decryptSecret } from '$lib/server/crypto';
import { getAllUsers } from '$lib/server/db/users';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { getTransactionsInRange } from '$lib/server/db/transactions';
import { getMonthlyReport, insertMonthlyReport } from '$lib/server/db/monthly-reports';
import {
	deletePushSubscriptionById,
	findPushSubscriptionsByUserId
} from '$lib/server/db/push-subscriptions';
import { generateMonthlySummary, type CategoryTotals } from '$lib/server/ai/report';
import type { AiProvider } from '$lib/ai-providers';

type Db = ReturnType<typeof getDb>;

interface MonthRange {
	yearMonth: string; // 'YYYY-MM'
	from: Date;
	to: Date; // exclusivo
}

// Mês anterior ao dia em que o cron roda (dia 1 do mês corrente, ver
// wrangler.jsonc `triggers.crons`) — usa UTC pra não depender do timezone do
// runtime do Worker.
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
	// Idempotente: se o cron rodar de novo (retry, ou reprocessamento manual),
	// nunca gera o mesmo relatório/push duas vezes.
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
	const accountTypeById = new Map(accounts.map((a) => [a.id, a.type]));

	let totalIncome = 0;
	let totalExpense = 0;
	const categoryTotals: CategoryTotals = {};
	for (const tx of transactions) {
		const accType = tx.accountId ? accountTypeById.get(tx.accountId) : undefined;

		if (accType === 'credit_card') {
			// Cartão de crédito: compra (positiva) é GASTO, não receita. O
			// pagamento da fatura já é excluído pelo filtro de transferência
			// interna em getTransactionsInRange.
			if (tx.amount > 0) {
				totalExpense += tx.amount;
				const category = tx.category ?? 'Outros';
				categoryTotals[category] = (categoryTotals[category] ?? 0) + tx.amount;
			}
			continue;
		}

		if (tx.amount >= 0) {
			totalIncome += tx.amount;
		} else {
			totalExpense += Math.abs(tx.amount);
			const category = tx.category ?? 'Outros';
			categoryTotals[category] = (categoryTotals[category] ?? 0) + Math.abs(tx.amount);
		}
	}
	const investmentBalance = accounts
		.filter((a) => a.type === 'investment')
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	// Mês anterior (se já existir) alimenta a comparação pedida no ESCOPO.md
	// §3.5 ("comparação mês a mês") — vem do summaryJson já salvo, sem
	// recalcular a partir das transações de novo.
	const previousReport = await getMonthlyReport(db, userId, previousYearMonth(range.yearMonth));
	const previousSummary = previousReport
		? (JSON.parse(previousReport.summaryJson) as ReportSummary)
		: null;

	const apiKey = await decryptSecret(env.MASTER_KEY, {
		ciphertext: aiCredentials.keyEncrypted,
		nonce: aiCredentials.nonce
	});

	const narrative = await generateMonthlySummary({
		provider: aiCredentials.provider as AiProvider,
		model: aiCredentials.model,
		apiKey,
		yearMonth: range.yearMonth,
		totalIncome,
		totalExpense,
		categoryTotals,
		investmentBalance,
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
			body: `Seu relatório de ${yearMonth} já está disponível no TabelaFin.`,
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
				// 404/410 = subscription morta (usuário desinstalou/revogou) — mesma
				// limpeza feita pelo TabelaCal em server/push/reminders.ts.
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
