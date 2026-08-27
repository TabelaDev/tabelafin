import { unauthorizedJson } from '$lib/server/api-auth';
import { getDb } from '$lib/server/db';
import { getPluggyStatus } from '$lib/server/services/pluggy-status.service';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

// Open Finance connection state — used by the onboarding ("already connected,
// verify?") and the profile page. Authenticated via the app session (the
// extension does not call this; the popup shows local status of the last
// submission).
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return unauthorizedJson();

	const db = getDb(platform!.env.DB);
	const pluggyStatus = await getPluggyStatus(db, locals.userId);

	return json({
		configured: pluggyStatus !== 'disconnected',
		status: pluggyStatus
	});
};
