import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [aiCredentials, pluggyCredentials] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId)
	]);

	if (!aiCredentials) redirect(303, '/onboarding/ai');
	if (!pluggyCredentials) redirect(303, '/onboarding/pluggy');
	redirect(303, '/dashboard');
};
