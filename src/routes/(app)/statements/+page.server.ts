import { getDb } from '$lib/server/db';
import { getStatementReviewsByUser } from '$lib/server/db/statement-reviews';
import { requireLogin } from '$lib/server/require-login';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const reviews = await getStatementReviewsByUser(db, locals.userId);

	return { reviews };
};
