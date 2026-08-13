import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { setUserSeenOnboarding } from '$lib/server/db/users';

// Encerra o onboarding sem exigir configuração completa — usado pelo botão
// "Pular" da última etapa (Open Finance). Marca `seenOnboarding` pra o modal
// não reabrir sozinho a cada login, mesmo sem IA/Open Finance configurados.
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const db = getDb(platform!.env.DB);
	await setUserSeenOnboarding(db, locals.userId, true);

	return json({ ok: true });
};
