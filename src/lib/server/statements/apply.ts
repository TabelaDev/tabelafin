import type { ParsedTransaction } from './types';
import { getDb } from '$lib/server/db';
import { insertPdfTransaction } from '$lib/server/db/transactions';
import { updateStatementReviewStatus } from '$lib/server/db/statement-reviews';
import { Currency } from '$lib/enums/currency';
import { Category } from '$lib/enums/category';
import { StatementReviewStatus } from '$lib/enums/statement-review';

export interface ApplyInput {
	userId: string;
	reviewId: string;
	platform: { env: { DB: D1Database } };
	transactions: ParsedTransaction[];
}

/**
 * Inserts approved transactions from a review into the transactions table.
 * Uses insertPdfTransaction which handles deduplication.
 */
export async function applyApprovedTransactions(
	input: ApplyInput
): Promise<{ inserted: number; duplicates: number }> {
	const { userId, reviewId, platform, transactions } = input;
	const db = getDb(platform.env.DB);

	let inserted = 0;
	let duplicates = 0;

	for (const tx of transactions) {
		const [dateYear, dateMonth, dateDay] = tx.date.split('-').map(Number);
		const date = new Date(Date.UTC(dateYear, dateMonth - 1, dateDay));

		const result = await insertPdfTransaction(db, {
			userId,
			statementUploadId: reviewId,
			date,
			description: tx.description,
			amount: tx.amount,
			currency: Currency.BRL,
			category: tx.category || Category.Uncategorized
		});

		if (result.supersededBy) {
			duplicates++;
		} else {
			inserted++;
		}
	}

	await updateStatementReviewStatus(db, reviewId, StatementReviewStatus.Applied, {
		transactionCount: inserted,
		duplicateCount: duplicates
	});

	return { inserted, duplicates };
}
