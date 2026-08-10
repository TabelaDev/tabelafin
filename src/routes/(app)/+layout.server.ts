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

	// Status de IA/Open Finance é global (aparece no pill flutuante de todas
	// as páginas) — carrega aqui, não em cada página.
	const db = getDb(platform!.env.DB);
	const [ai, pluggy, user, pluggyItems] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId),
		findUserById(db, locals.userId),
		getPluggyItemsByUser(db, locals.userId)
	]);

	// Garante que todo usuário tenha categorias (padrão no primeiro acesso).
	// Idempotente: não faz nada se já existirem.
	await ensureDefaultCategories(db, locals.userId);

	// Primeiro acesso: usuário que ainda não viu o onboarding vê o modal de
	// configuração sobre o app (ver +layout.svelte).
	const seenOnboarding = user?.seenOnboarding ?? false;

	// Pluggy conectado mas items nunca sincronizados (ex.: conexão feita antes
	// do sync pós-conexão existir) — dispara o sync em background pra trazer os
	// dados sem esperar o cron diário.
	if (pluggy && pluggyItems.some((item) => !item.lastSyncedAt)) {
		const syncPromise = syncUserItems(db, platform!.env.MASTER_KEY, locals.userId).catch((err) => {
			console.error('[layout/app] sync de recuperação falhou', {
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
		hideAi: user?.hideAi ?? false,
		seenOnboarding
	};
};
