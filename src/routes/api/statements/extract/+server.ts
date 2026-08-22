import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StatementReviewStatus } from '$lib/enums/statement-review';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/statements/extract
 *
 * Receives a file + bank hint, creates a statement_review, extracts transactions
 * using parser or AI, and returns the review ID.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userId) error(401, 'Não autenticado.');

	const formData = await request.formData().catch(() => null);
	const file = formData?.get('file');
	const bankHint = (formData?.get('bank') as string) || undefined;

	if (!(file instanceof File)) error(400, 'Envie um arquivo.');
	if (file.size === 0) error(400, 'O arquivo está vazio.');
	if (file.size > MAX_FILE_BYTES) error(400, 'O arquivo não pode passar de 10 MB.');

	const review = await locals.statementService.createReview(locals.userId, file, bankHint);

	try {
		const result = await locals.statementService.extractTransactions(locals.userId, file, bankHint);

		await locals.statementService.updateReviewStatus(review.id, StatementReviewStatus.Ready, {
			extractedJson: JSON.stringify(result.transactions),
			transactionCount: result.transactions.length,
			duplicateCount: 0
		});

		return json({
			reviewId: review.id,
			count: result.transactions.length,
			method: result.method,
			transactions: result.transactions
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await locals.statementService.updateReviewStatus(review.id, StatementReviewStatus.Cancelled, {
			errorMessage: message
		});
		error(502, message);
	}
};
