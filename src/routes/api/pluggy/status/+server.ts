import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getPluggyItemsByUser } from '$lib/server/db/pluggy-items';

// Open Finance connection state — used by the onboarding ("already connected,
// verify?") and the profile page. Authenticated via the app session (the
// extension does not call this; the popup shows local status of the last
// submission).
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const db = getDb(platform!.env.DB);
	const [credentials, items] = await Promise.all([
		getPluggyCredentials(db, locals.userId),
		getPluggyItemsByUser(db, locals.userId)
	]);

	const lastSyncedAt =
		items.map((i) => i.lastSyncedAt?.getTime() ?? 0).sort((a, b) => b - a)[0] ?? null;

	return json({
		configured: Boolean(credentials),
		items: items.length,
		lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null
	});
};
