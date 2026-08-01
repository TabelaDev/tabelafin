import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AI_PROVIDERS, type AiProvider } from '$lib/ai-providers';
import { encryptSecret } from '$lib/server/crypto';
import { getDb } from '$lib/server/db';
import { upsertAiCredentials } from '$lib/server/db/ai-credentials';

function isAiProvider(value: string): value is AiProvider {
	return value in AI_PROVIDERS;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userId) redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const provider = form.get('provider');
		const model = form.get('model');
		const apiKey = form.get('apiKey');

		if (typeof provider !== 'string' || !isAiProvider(provider)) {
			return fail(400, { error: 'Selecione um provedor de IA válido.' });
		}
		if (typeof model !== 'string' || !AI_PROVIDERS[provider].models.some((m) => m.id === model)) {
			return fail(400, { error: 'Selecione um modelo válido.' });
		}
		if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
			return fail(400, { error: 'Informe sua API key.' });
		}

		const encrypted = await encryptSecret(platform!.env.MASTER_KEY, apiKey.trim());
		const db = getDb(platform!.env.DB);
		await upsertAiCredentials(db, {
			userId: locals.userId,
			provider,
			model,
			keyEncrypted: encrypted.ciphertext,
			nonce: encrypted.nonce
		});

		redirect(303, '/onboarding/pluggy');
	}
};
