import { StatementReviewStatus } from '$lib/enums/statement-review';
import { requireAuth } from '$lib/server/api-auth';

import { error, json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

interface ApplyRequest {
	reviewId: string;
	transactions: { date: string; description: string; amount: number; category?: string }[];
}

/**
 * POST /api/statements/apply
 *
 * Receives a review ID + approved transactions, inserts them into the DB.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userId) requireAuth();

	const body = (await request.json().catch(() => null)) as ApplyRequest | null;
	if (!body?.reviewId) error(400, 'reviewId é obrigatório.');
	if (!Array.isArray(body?.transactions)) error(400, 'transactions é obrigatório.');

	const review = await locals.statementService.getReviewById(body.reviewId, locals.userId);
	if (!review) error(404, 'Review não encontrado.');
	if (review.status !== StatementReviewStatus.Ready)
		error(400, 'Este review não está pendente de aprovação.');

	const { inserted, duplicates } = await locals.statementService.applyTransactions(
		locals.userId,
		body.reviewId,
		body.transactions
	);

	return json({
		success: true,
		inserted,
		duplicates
	});
};
