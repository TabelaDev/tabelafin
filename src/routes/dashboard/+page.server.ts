import { redirect } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getLatestMonthlyReport } from '$lib/server/db/monthly-reports';
import { accounts, transactions } from '$lib/server/db/schema';
import type { ReportSummary } from '$lib/server/reports/generate';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [aiCredentials, pluggyCredentials] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId)
	]);
	if (!aiCredentials) redirect(303, '/onboarding/ai');
	if (!pluggyCredentials) redirect(303, '/onboarding/pluggy');

	const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, locals.userId));
	// superseded_by_transaction_id não-nulo = linha de PDF substituída por uma
	// transação equivalente vinda da Pluggy depois (ESCOPO.md §5) — nunca
	// aparece em dashboard/relatório.
	const recentTransactions = await db
		.select()
		.from(transactions)
		.where(
			and(eq(transactions.userId, locals.userId), isNull(transactions.supersededByTransactionId))
		)
		.orderBy(desc(transactions.date))
		.limit(10);

	const latestReport = await getLatestMonthlyReport(db, locals.userId);

	return {
		aiProvider: aiCredentials.provider,
		aiModel: aiCredentials.model,
		accounts: userAccounts,
		recentTransactions,
		vapidPublicKey: platform!.env.VAPID_PUBLIC_KEY,
		latestReport: latestReport
			? {
					yearMonth: latestReport.yearMonth,
					summary: JSON.parse(latestReport.summaryJson) as ReportSummary
				}
			: null
	};
};
