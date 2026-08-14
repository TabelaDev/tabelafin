import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getPluggyItemsByUser } from '$lib/server/db/pluggy-items';
import { findUserById } from '$lib/server/db/users';
import { ensureDefaultCategories } from '$lib/server/db/user-categories';
import { syncUserItems } from '$lib/server/pluggy/sync';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	// The AI/Open Finance status is global (it shows in the floating pill on every
	// page) — loaded here rather than in each page.
	const db = getDb(platform!.env.DB);
	const [ai, pluggy, user, pluggyItems] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId),
		findUserById(db, locals.userId),
		getPluggyItemsByUser(db, locals.userId)
	]);

	// Makes sure every user has categories (the defaults, on first visit).
	// Idempotent: does nothing when they already exist.
	await ensureDefaultCategories(db, locals.userId);

	// First visit: a user who has not seen the onboarding gets the configuration
	// modal over the app (see +layout.svelte).
	const seenOnboarding = user?.seenOnboarding ?? false;

	// The Meu Pluggy token lasts ~24h (its `exp` is stored on receipt). Saying
	// "conectado" when the token already expired is a lie — the sync would fail.
	// Null expiry (a credential stored before the column existed) is treated as
	// connected until the extension refreshes the token.
	const pluggyStatus: 'connected' | 'expired' | 'disconnected' = pluggy
		? pluggy.tokenExpiresAt && pluggy.tokenExpiresAt.getTime() <= Date.now()
			? 'expired'
			: 'connected'
		: 'disconnected';

	// Pluggy connected but the items never synced (a connection made before the
	// post-connection sync existed) — kicks off the sync in the background so the
	// data arrives without waiting for the daily cron.
	if (pluggy && pluggyItems.some((item) => !item.lastSyncedAt)) {
		const syncPromise = syncUserItems(db, platform!.env.MASTER_KEY, locals.userId).catch((err) => {
			console.error('[layout/app] recovery sync failed', {
				userId: locals.userId,
				error: err instanceof Error ? err.message : String(err)
			});
		});
		platform!.ctx.waitUntil(syncPromise);
	}

	return {
		userId: locals.userId,
		aiConfigured: Boolean(ai),
		pluggyConfigured: Boolean(pluggy),
		pluggyStatus,
		hideAi: user?.hideAi ?? false,
		seenOnboarding
	};
};
