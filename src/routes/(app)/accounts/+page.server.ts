import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { financeAccounts as accounts } from '$lib/server/db/schema';
import { signedBalance, sumSignedBalance } from '$lib/accounts';

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
		// Sorted on the signed axis: by raw balance the card climbs to the top as
		// if its open invoice were the user's largest account.
		accounts: [...userAccounts].sort((a, b) => signedBalance(b) - signedBalance(a)),
		summary: {
			// `credit` stays the debt as a magnitude — its own card already renders
			// the "-" and the "fatura em aberto" label. Only the total sums signed.
			total: sumSignedBalance(userAccounts),
			checking: Math.round(checking * 100) / 100,
			investment: Math.round(investment * 100) / 100,
			credit: Math.round(credit * 100) / 100
		}
	};
};
