import { unauthorizedJson } from '$lib/server/api-auth';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.userId) return unauthorizedJson();

	await locals.userService.setSeenOnboarding(locals.userId, true);

	return json({ ok: true });
};
