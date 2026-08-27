import { AccountType } from '$lib/enums/account-type';
import { getDb } from '$lib/server/db';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { classifyMovement, getFutureTransactions } from '$lib/server/db/transactions';
import { requireLogin } from '$lib/server/require-login';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	// Future entries: card instalments the bank pre-posts with an invoice date in
	// the future (date > today) — the same as the card issuer's "upcoming
	// invoices" tab.
	const future = await getFutureTransactions(db, userId);

	const userAccounts = await getAccountsByUser(db, userId);
	const accountById = new Map(
		userAccounts.map((a) => [a.id, { ...a, type: a.type as AccountType }])
	);

	// Net commitment, not the sum of magnitudes. `Math.abs` made a pre-posted
	// refund *raise* the amount owed instead of reducing it, so the screen
	// promised a bigger bill than the card actually holds.
	const total = future.reduce((sum, tx) => {
		const { income, expense } = classifyMovement(
			tx.accountId ? accountById.get(tx.accountId)?.type : undefined,
			tx.amount
		);
		return sum + expense - income;
	}, 0);

	return {
		future: future
			.map((tx) => ({
				...tx,
				accountName: tx.accountId ? (accountById.get(tx.accountId)?.name ?? null) : null
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime()),
		total: total
	};
};
