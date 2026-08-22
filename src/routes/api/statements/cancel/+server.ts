import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StatementReviewStatus } from '$lib/enums/statement-review';

interface CancelRequest {
	reviewId: string;
}

/**
 * POST /api/statements/cancel
 *
 * Receives a review ID, marks it as cancelled.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userId) error(401, 'Não autenticado.');

	const body = (await request.json().catch(() => null)) as CancelRequest | null;
	if (!body?.reviewId) error(400, 'reviewId é obrigatório.');

	const review = await locals.statementService.getReviewById(body.reviewId, locals.userId);
	if (!review) error(404, 'Review não encontrado.');
	if (review.status === StatementReviewStatus.Applied) error(400, 'Este review já foi aplicado.');
	if (review.status === StatementReviewStatus.Cancelled)
		error(400, 'Este review já foi cancelado.');

	await locals.statementService.cancelReview(body.reviewId);

	return json({ success: true });
};
