import { redirect } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAccountsByUser } from '$lib/server/db/accounts';
import { transactions } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	// Lançamentos futuros: parcelas de cartão que o Nubank pré-lança com data
	// de fatura à frente (date > hoje). Igual à aba "próximas faturas" do app.
	const now = new Date();
	const future = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				gt(transactions.date, now),
				isNull(transactions.supersededByTransactionId)
			)
		)
		.orderBy(transactions.date);

	const userAccounts = await getAccountsByUser(db, userId);
	const accountById = new Map(userAccounts.map((a) => [a.id, a]));

	return {
		future: future
			.map((tx) => ({
				...tx,
				accountName: tx.accountId ? (accountById.get(tx.accountId)?.name ?? null) : null
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime()),
		total: future.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
	};
};
