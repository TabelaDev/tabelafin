import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { findUserById, setUserHideAi } from '$lib/server/db/users';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [ai, pluggy, user] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId),
		findUserById(db, locals.userId)
	]);

	return {
		user: locals.session?.user ?? null,
		hideAi: user?.hideAi ?? false,
		aiConfigured: Boolean(ai),
		aiProvider: ai?.provider ?? null,
		aiModel: ai?.model ?? null,
		pluggyConfigured: Boolean(pluggy)
	};
};

export const actions: Actions = {
	hideAi: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const hidden = form.get('hideAi') === 'on';

		const db = getDb(platform!.env.DB);
		await setUserHideAi(db, locals.userId, hidden);

		return { hideAi: hidden };
	}
};
