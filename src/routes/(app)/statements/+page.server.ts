import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getStatementReviewsByUser } from '$lib/server/db/statement-reviews';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const reviews = await getStatementReviewsByUser(db, locals.userId);

	return { reviews };
};
