import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { decryptSecret } from '$lib/server/crypto';
import { getApiKey, createConnectToken } from '$lib/server/pluggy/client';

// Endpoint chamado pelo componente client-side ($lib/PluggyConnect.svelte)
// pra conseguir o connectToken de curta duração (30min) que o widget precisa
// — o apiKey de backend nunca é exposto ao browser (ver client.ts).
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) error(401, 'Não autenticado.');

	const db = getDb(platform!.env.DB);
	const credentials = await getPluggyCredentials(db, locals.userId);
	if (!credentials) error(400, 'Configure suas credenciais do Meu Pluggy antes de conectar.');

	const clientId = await decryptSecret(platform!.env.MASTER_KEY, {
		ciphertext: credentials.clientIdEncrypted,
		nonce: credentials.clientIdNonce
	});
	const clientSecret = await decryptSecret(platform!.env.MASTER_KEY, {
		ciphertext: credentials.clientSecretEncrypted,
		nonce: credentials.clientSecretNonce
	});

	const apiKey = await getApiKey(clientId, clientSecret);
	const connectToken = await createConnectToken(apiKey);

	return json({ connectToken });
};
