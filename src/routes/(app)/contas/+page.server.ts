import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { financeAccounts as accounts } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));

	const checking = userAccounts
		.filter((a) => a.type === 'checking')
		.reduce((sum, a) => sum + a.cachedBalance, 0);
	const investment = userAccounts
		.filter((a) => a.type === 'investment')
		.reduce((sum, a) => sum + a.cachedBalance, 0);
	const credit = userAccounts
		.filter((a) => a.type === 'credit_card')
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	return {
		accounts: [...userAccounts].sort((a, b) => b.cachedBalance - a.cachedBalance),
		summary: {
			total: Math.round(userAccounts.reduce((sum, a) => sum + a.cachedBalance, 0) * 100) / 100,
			checking: Math.round(checking * 100) / 100,
			investment: Math.round(investment * 100) / 100,
			credit: Math.round(credit * 100) / 100
		}
	};
};
