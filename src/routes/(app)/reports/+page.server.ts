import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getLatestMonthlyReport } from '$lib/server/db/monthly-reports';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const latestReport = await getLatestMonthlyReport(db, locals.userId);

	return {
		latestReport: latestReport
			? {
					yearMonth: latestReport.yearMonth,
					summary: JSON.parse(latestReport.summaryJson),
					generatedAt: latestReport.generatedAt.toISOString()
				}
			: null
	};
};
