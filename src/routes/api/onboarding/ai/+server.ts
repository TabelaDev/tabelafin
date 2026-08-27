import { unauthorizedJson } from '$lib/server/api-auth';
import { encryptSecret } from '$lib/server/crypto';
import { getDb } from '$lib/server/db';
import { upsertAiCredentials } from '$lib/server/db/ai-credentials';
import { AI_PROVIDERS, type AiProvider } from '$lib/utils/ai-providers';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

function isAiProvider(value: string): value is AiProvider {
	return value in AI_PROVIDERS;
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.userId) return unauthorizedJson();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
	}

	const provider = (body as { provider?: unknown } | null)?.provider;
	const model = (body as { model?: unknown } | null)?.model;
	const apiKey = (body as { apiKey?: unknown } | null)?.apiKey;

	if (typeof provider !== 'string' || !isAiProvider(provider)) {
		return json({ error: 'Selecione um provedor de IA válido.' }, { status: 400 });
	}
	if (typeof model !== 'string' || !AI_PROVIDERS[provider].models.some((m) => m.id === model)) {
		return json({ error: 'Selecione um modelo válido.' }, { status: 400 });
	}
	if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
		return json({ error: 'Informe sua API key.' }, { status: 400 });
	}

	const masterKey = platform!.env.MASTER_KEY;
	if (!masterKey) {
		console.error('[onboarding/ai] MASTER_KEY não configurada no ambiente');
		return json({ error: 'Erro de configuração do servidor.' }, { status: 500 });
	}

	const encrypted = await encryptSecret(masterKey, apiKey.trim(), {
		purpose: 'ai_credentials',
		userId: locals.userId
	});
	const db = getDb(platform!.env.DB);
	try {
		await upsertAiCredentials(db, {
			userId: locals.userId,
			provider,
			model,
			keyEncrypted: encrypted.ciphertext,
			nonce: encrypted.nonce,
			v: encrypted.v
		});
	} catch (e) {
		console.error('[onboarding/ai] Erro ao salvar credenciais:', e);
		return json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
	}

	return json({ ok: true });
};
