import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import {
	getStatementReviewById,
	updateStatementReviewStatus
} from '$lib/server/db/statement-reviews';
import { setFlash } from 'sveltekit-flash-message/server';
import { ToastType } from '$lib/enums/toast-type';
import { StatementReviewStatus } from '$lib/enums/statement-review';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.userId) redirect(303, '/login');

	const reviewId = url.searchParams.get('id');
	if (!reviewId) error(400, 'ID do review é obrigatório.');

	const db = getDb(platform!.env.DB);
	const review = await getStatementReviewById(db, reviewId, locals.userId);
	if (!review) error(404, 'Review não encontrado.');

	let transactions: { date: string; description: string; amount: number; category?: string }[] = [];
	if (review.extractedJson) {
		try {
			transactions = JSON.parse(review.extractedJson);
		} catch {
			transactions = [];
		}
	}

	return {
		review,
		transactions
	};
};

export const actions: Actions = {
	cancel: async ({ locals, platform, url, request }) => {
		if (!locals.userId) redirect(303, '/login');

		const formData = await request.formData();
		const reviewId = formData.get('reviewId') as string;
		if (!reviewId) error(400, 'reviewId é obrigatório.');

		const db = getDb(platform!.env.DB);
		await updateStatementReviewStatus(db, reviewId, StatementReviewStatus.Cancelled);

		setFlash({ type: ToastType.success, message: 'Importação cancelada.' }, {
			cookies: {},
			url
		} as any);
		return { success: true };
	}
};
