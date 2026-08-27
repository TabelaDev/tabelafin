import { getDb } from '$lib/server/db';
import { getLatestMonthlyReport } from '$lib/server/db/monthly-reports';
import { requireLogin } from '$lib/server/require-login';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const latestReport = await getLatestMonthlyReport(db, locals.userId);

	return {
		// Needed by PushSubscribe. Nothing rendered that component, so
		// `push_subscriptions` never received a row and `sendReportReadyPush`
		// always returned early — the entire notification path was dead while the
		// README advertised it. This screen is the right home for the opt-in: it
		// is where someone is already thinking about the monthly report.
		vapidPublicKey: platform!.env.VAPID_PUBLIC_KEY,
		latestReport: latestReport
			? {
					yearMonth: latestReport.yearMonth,
					summary: JSON.parse(latestReport.summaryJson),
					generatedAt: latestReport.generatedAt.toISOString()
				}
			: null
	};
};
