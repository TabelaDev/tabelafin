import { eq, and } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { statementReviews } from '$lib/server/db/schema';
import { StatementReviewStatus, StatementSource, StatementBank } from '$lib/enums/statement-review';

export { StatementReviewStatus, StatementSource, StatementBank };

export interface NewStatementReviewInput {
	userId: string;
	source: StatementSource;
	bank?: StatementBank;
	filename: string;
}

export async function createStatementReview(
	db: ReturnType<typeof getDb>,
	input: NewStatementReviewInput
) {
	const [row] = await db
		.insert(statementReviews)
		.values({
			userId: input.userId,
			source: input.source,
			bank: input.bank,
			filename: input.filename,
			status: StatementReviewStatus.Pending
		})
		.returning();
	return row;
}

export async function updateStatementReviewStatus(
	db: ReturnType<typeof getDb>,
	reviewId: string,
	status: StatementReviewStatus,
	extra?: {
		extractedJson?: string;
		transactionCount?: number;
		duplicateCount?: number;
		errorMessage?: string;
	}
) {
	await db
		.update(statementReviews)
		.set({
			status,
			...(extra?.extractedJson !== undefined && { extractedJson: extra.extractedJson }),
			...(extra?.transactionCount !== undefined && { transactionCount: extra.transactionCount }),
			...(extra?.duplicateCount !== undefined && { duplicateCount: extra.duplicateCount }),
			...(extra?.errorMessage !== undefined && { errorMessage: extra.errorMessage }),
			...(status === StatementReviewStatus.Applied && { appliedAt: new Date() })
		})
		.where(eq(statementReviews.id, reviewId));
}

export async function getStatementReviewById(
	db: ReturnType<typeof getDb>,
	reviewId: string,
	userId: string
) {
	return db.query.statementReviews.findFirst({
		where: and(eq(statementReviews.id, reviewId), eq(statementReviews.userId, userId))
	});
}

export async function getStatementReviewsByUser(db: ReturnType<typeof getDb>, userId: string) {
	return db.query.statementReviews.findMany({
		where: eq(statementReviews.userId, userId),
		orderBy: (reviews, { desc }) => [desc(reviews.createdAt)]
	});
}

export async function saveApprovedTransactions(
	db: ReturnType<typeof getDb>,
	reviewId: string,
	approvedJson: string
) {
	await db
		.update(statementReviews)
		.set({
			approvedJson,
			status: StatementReviewStatus.Ready
		})
		.where(eq(statementReviews.id, reviewId));
}
