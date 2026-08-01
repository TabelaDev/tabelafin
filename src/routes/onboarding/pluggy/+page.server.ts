import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials, upsertPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { encryptSecret } from '$lib/server/crypto';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const aiCredentials = await getAiCredentials(db, locals.userId);
	if (!aiCredentials) redirect(303, '/onboarding/ai');

	// Se as credenciais já foram salvas numa visita anterior, pula direto pro
	// passo de conectar (o form de Client ID/Secret já cumpriu seu papel).
	const pluggyCredentials = await getPluggyCredentials(db, locals.userId);
	return { hasCredentials: Boolean(pluggyCredentials) };
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const clientId = form.get('clientId');
		const clientSecret = form.get('clientSecret');

		if (typeof clientId !== 'string' || clientId.trim().length === 0) {
			return fail(400, { error: 'Informe o Client ID do Meu Pluggy.' });
		}
		if (typeof clientSecret !== 'string' || clientSecret.trim().length === 0) {
			return fail(400, { error: 'Informe o Client Secret do Meu Pluggy.' });
		}

		const masterKey = platform!.env.MASTER_KEY;
		const [encryptedId, encryptedSecret] = await Promise.all([
			encryptSecret(masterKey, clientId.trim()),
			encryptSecret(masterKey, clientSecret.trim())
		]);

		const db = getDb(platform!.env.DB);
		await upsertPluggyCredentials(db, {
			userId: locals.userId,
			clientIdEncrypted: encryptedId.ciphertext,
			clientIdNonce: encryptedId.nonce,
			clientSecretEncrypted: encryptedSecret.ciphertext,
			clientSecretNonce: encryptedSecret.nonce
		});

		// Sem redirect pro dashboard aqui de propósito (ESCOPO.md §3.1: o
		// onboarding de Open Finance tem 2 sub-passos — colar credenciais E
		// conectar via widget). `success` liga o passo 2 no mesmo componente
		// Svelte, sem navegação de página.
		return { success: true };
	}
};
