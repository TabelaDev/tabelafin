import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { setUserSeenOnboarding } from '$lib/server/db/users';

// Finishes onboarding without requiring full configuration — used by the
// "Skip" button on the last step (Open Finance). Marks `seenOnboarding` so the
// modal does not reopen on every login, even without AI/Open Finance set up.
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const db = getDb(platform!.env.DB);
	await setUserSeenOnboarding(db, locals.userId, true);

	return json({ ok: true });
};
