import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getPluggyItemsByUser } from '$lib/server/db/pluggy-items';

// Estado da conexão Open Finance — usado pelo onboarding ("já conectei, verifica?")
// e pela página de perfil. Autenticado pela sessão do app (a extensão não
// consulta isto; o popup mostra o status local do último envio).
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
