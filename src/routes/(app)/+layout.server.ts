import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getPluggyItemsByUser, shouldRecoverySync } from '$lib/server/db/pluggy-items';
import { ensureDefaultCategories } from '$lib/server/db/user-categories';
import { syncUserItems } from '$lib/server/pluggy/sync';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [ai, pluggy, user, pluggyItems] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId),
		locals.userService.findById(locals.userId),
		getPluggyItemsByUser(db, locals.userId)
	]);

	try {
		await ensureDefaultCategories(db, locals.userId);
	} catch (err) {
		const cause = err instanceof Error ? err.cause : undefined;
		console.error('[layout/app] ensureDefaultCategories failed', {
			userId: locals.userId,
			error: err instanceof Error ? err.message : String(err),
			cause: cause instanceof Error ? cause.message : String(cause)
		});
	}

	const seenOnboarding = user?.seenOnboarding ?? false;

	const pluggyStatus: 'connected' | 'expired' | 'disconnected' = pluggy
		? pluggy.tokenExpiresAt && pluggy.tokenExpiresAt.getTime() <= Date.now()
			? 'expired'
			: 'connected'
		: 'disconnected';

	if (pluggy && shouldRecoverySync(pluggyItems)) {
		const syncPromise = syncUserItems(db, platform!.env.MASTER_KEY, locals.userId, {
			skipAiCategorization: true
		}).catch((err) => {
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
		aiChatEnabled: user?.aiChatEnabled ?? true,
		seenOnboarding
	};
};
