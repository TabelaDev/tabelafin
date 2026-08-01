import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';

// TODO(pluggy-onboarding): esta página ainda é um placeholder. Falta o form
// de Client ID/Secret do Meu Pluggy (ESCOPO.md §2.3/§3.1) + integração com o
// Pluggy Connect Widget pra conectar Nubank/XP de fato.
export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const aiCredentials = await getAiCredentials(db, locals.userId);
	if (!aiCredentials) redirect(303, '/onboarding/ai');
};
