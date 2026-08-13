import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { upsertPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { upsertPluggyItem } from '$lib/server/db/pluggy-items';
import { setUserSeenOnboarding } from '$lib/server/db/users';
import { encryptSecret } from '$lib/server/crypto';
import { fetchItems } from '$lib/server/pluggy/client';
import { syncUserItems } from '$lib/server/pluggy/sync';
import { DEVICE_TOKEN_KV_PREFIX } from '$lib/server/pluggy/device-token';

// Recebe o token do Meu Pluggy capturado pela extensão (docs/pluggy-integration.md).
//
// A autenticação é por device token (pareado uma vez), não pelo cookie de
// sessão — a extensão roda fora do app e o cookie é HttpOnly + SameSite=Lax.
// O token do Meu Pluggy expira em ~24h; a extensão reenvia um token fresco
// toda vez que o usuário abre o Meu Pluggy, então este endpoint é um "upsert"
// idempotente que também dispara um sync em background (waitUntil).
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

	// Validar o token também serve pra descobrir as conexões (items) do usuário —
	// a extensão só entrega o token, os items vêm daqui.
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
	await upsertPluggyCredentials(db, {
		userId,
		tokenEncrypted: encrypted.ciphertext,
		tokenNonce: encrypted.nonce,
		v: encrypted.v
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

	// O usuário agora tem credencial + conexões: onboarding pode ser considerado
	// visto (senão o modal reabriria a cada login mesmo depois de conectar).
	await setUserSeenOnboarding(db, userId, true);

	const syncPromise = syncUserItems(db, masterKey, userId).catch((err) => {
		console.error('[pluggy/token] sync pós-token falhou', {
			userId,
			error: err instanceof Error ? err.message : String(err)
		});
	});
	platform!.ctx.waitUntil(syncPromise);

	return json({ ok: true, count: items.length });
};
