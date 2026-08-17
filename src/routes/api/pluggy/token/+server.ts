import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { upsertPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import {
	getPluggyItemsByUser,
	shouldRefreshSync,
	upsertPluggyItem
} from '$lib/server/db/pluggy-items';
import { setUserSeenOnboarding } from '$lib/server/db/users';
import { encryptSecret } from '$lib/server/crypto';
import { fetchItems, jwtExpiresAt } from '$lib/server/pluggy/client';
import { syncUserItems } from '$lib/server/pluggy/sync';
import { DEVICE_TOKEN_KV_PREFIX } from '$lib/server/pluggy/device-token';

// Receives the Meu Pluggy token captured by the extension
// (docs/pluggy-integration.md).
//
// Authentication is via device token (paired once), not the session cookie —
// the extension runs outside the app and the cookie is HttpOnly + SameSite=Lax.
// The Meu Pluggy token expires in ~24 h; the extension resends a fresh token
// every time the user opens Meu Pluggy, so this endpoint is an idempotent
// "upsert" that also fires a background sync (waitUntil).
export const POST: RequestHandler = async ({ request, platform }) => {
	const auth = request.headers.get('authorization') ?? '';
	const deviceToken = auth.replace(/^Bearer\s+/i, '').trim();
	if (!deviceToken) return json({ error: 'Device token ausente.' }, { status: 401 });

	const userId = await platform!.env.SESSIONS.get(`${DEVICE_TOKEN_KV_PREFIX}${deviceToken}`);
	if (!userId) return json({ error: 'Código de pareamento inválido.' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
	const token = typeof body?.token === 'string' ? body.token.trim() : '';
	if (!token) return json({ error: 'Token do Meu Pluggy ausente.' }, { status: 400 });

	const db = getDb(platform!.env.DB);

	// Validating the token also discovers the user's connections (items) — the
	// extension only delivers the token; the items come from here.
	let items;
	try {
		items = await fetchItems(token);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (/401|Unauthorized/.test(msg)) {
			return json(
				{
					error: 'Token do Meu Pluggy inválido ou expirado. Reabra o Meu Pluggy pra gerar um novo.'
				},
				{ status: 400 }
			);
		}
		console.error('[pluggy/token] falha ao validar token do Meu Pluggy', {
			userId,
			error: msg
		});
		return json(
			{ error: 'Não foi possível validar o token agora. Tente de novo.' },
			{ status: 502 }
		);
	}

	if (!items || items.length === 0) {
		return json(
			{
				error: 'Token válido, mas nenhuma conexão no Meu Pluggy. Conecte suas contas lá primeiro.'
			},
			{ status: 400 }
		);
	}

	const masterKey = platform!.env.MASTER_KEY;
	if (!masterKey) {
		console.error('[pluggy/token] MASTER_KEY não configurada no ambiente');
		return json({ error: 'Erro de configuração do servidor.' }, { status: 500 });
	}

	const encrypted = await encryptSecret(masterKey, token, {
		purpose: 'pluggy_credentials',
		userId
	});
	const expiresAt = jwtExpiresAt(token);
	await upsertPluggyCredentials(db, {
		userId,
		tokenEncrypted: encrypted.ciphertext,
		tokenNonce: encrypted.nonce,
		v: encrypted.v,
		tokenExpiresAt: expiresAt ? new Date(expiresAt) : null
	});

	for (const item of items) {
		await upsertPluggyItem(db, {
			userId,
			pluggyItemId: item.id,
			institutionName: item.institutionName,
			institutionType: item.institutionType,
			status: item.status
		});
	}

	// The user now has credentials + connections: onboarding can be considered
	// seen (otherwise the modal would reopen on every login even after
	// connecting).
	await setUserSeenOnboarding(db, userId, true);

	// The extension re-posts the token on every visit to Meu Pluggy, so this
	// endpoint is not a once-per-connection event — it can fire several times a
	// day. Throttle the sync it triggers; storing the fresh token above always
	// happens, which is what keeps the daily cron working.
	const userItems = await getPluggyItemsByUser(db, userId);
	if (shouldRefreshSync(userItems)) {
		const syncPromise = syncUserItems(db, masterKey, userId, { items: userItems }).catch((err) => {
			console.error('[pluggy/token] sync pós-token falhou', {
				userId,
				error: err instanceof Error ? err.message : String(err)
			});
		});
		platform!.ctx.waitUntil(syncPromise);
	}

	return json({ ok: true, count: items.length });
};
