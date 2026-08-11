import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { upsertPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { upsertPluggyItem } from '$lib/server/db/pluggy-items';
import { setUserSeenOnboarding } from '$lib/server/db/users';
import { encryptSecret } from '$lib/server/crypto';
import { fetchItems } from '$lib/server/pluggy/client';
import { syncUserItems } from '$lib/server/pluggy/sync';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
	}

	const token = (body as { token?: unknown } | null)?.token;

	if (typeof token !== 'string' || token.trim().length === 0) {
		return json({ error: 'Cole o token de acesso do Meu Pluggy (JWT).' }, { status: 400 });
	}

	const trimmedToken = token.trim();

	const db = getDb(platform!.env.DB);

	// Onboarding exige IA configurada antes de conectar Open Finance.
	const aiCredentials = await getAiCredentials(db, locals.userId);
	if (!aiCredentials) {
		return json({ error: 'Configure a IA antes de conectar o Open Finance.' }, { status: 400 });
	}

	// Validates the token and fetches the user's items (bank connections).
	let items;
	try {
		items = await fetchItems(trimmedToken);
		if (!items || items.length === 0) {
			return json(
				{
					error:
						'Token válido mas nenhuma conexão encontrada no Meu Pluggy. Conecte suas contas (Nubank, XP) em meu.pluggy.ai primeiro.'
				},
				{ status: 400 }
			);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('401') || msg.includes('Unauthorized')) {
			return json(
				{
					error:
						'Token inválido ou expirado. Faça login em meu.pluggy.ai e gere um novo token de acesso.'
				},
				{ status: 400 }
			);
		}
		return json({ error: 'Não foi possível validar o token. Tente novamente.' }, { status: 400 });
	}

	const masterKey = platform!.env.MASTER_KEY;
	if (!masterKey) {
		console.error('[onboarding/pluggy] MASTER_KEY não configurada no ambiente');
		return json({ error: 'Erro de configuração do servidor.' }, { status: 500 });
	}

	// Stores the token encrypted.
	const encrypted = await encryptSecret(masterKey, trimmedToken, {
		purpose: 'pluggy_credentials',
		userId: locals.userId
	});
	await upsertPluggyCredentials(db, {
		userId: locals.userId,
		tokenEncrypted: encrypted.ciphertext,
		tokenNonce: encrypted.nonce,
		v: encrypted.v
	});

	// Creates/updates the pluggy_items (bank connections) from the items the Meu
	// Pluggy API returned — the sync needs them to know which items to sync.
	for (const item of items) {
		await upsertPluggyItem(db, {
			userId: locals.userId,
			pluggyItemId: item.id,
			institutionName: item.institutionName,
			institutionType: item.institutionType,
			status: item.status
		});
	}

	// Onboarding finished — marked as seen so it does not reappear on the next
	// login.
	await setUserSeenOnboarding(db, locals.userId, true);

	// Fetches the data straight away (accounts/transactions/investments + dedupe +
	// batch categorisation) instead of waiting for the daily cron. Runs in the
	// background (waitUntil) so it does not hold up the modal's response; if it
	// fails, the cron picks it up later.
	const syncPromise = syncUserItems(db, masterKey, locals.userId).catch((err) => {
		console.error('[onboarding/pluggy] sync pós-conexão falhou', {
			userId: locals.userId,
			error: err instanceof Error ? err.message : String(err)
		});
	});
	platform!.ctx.waitUntil(syncPromise);

	return json({ ok: true });
};
