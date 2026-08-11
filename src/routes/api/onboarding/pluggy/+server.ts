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

	// Valida o token e busca os itens (conexões bancárias) do usuário.
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

	// Salva o token cifrado.
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

	// Cria/atualiza os pluggy_items (conexões bancárias) a partir dos itens
	// retornados pela API do Meu Pluggy — o sync precisa deles pra saber
	// quais items sincronizar.
	for (const item of items) {
		await upsertPluggyItem(db, {
			userId: locals.userId,
			pluggyItemId: item.id,
			institutionName: item.institutionName,
			institutionType: item.institutionType,
			status: item.status
		});
	}

	// Concluiu o onboarding — marca como visto pra não reaparecer no próximo
	// login.
	await setUserSeenOnboarding(db, locals.userId, true);

	// Busca os dados logo de cara (accounts/transactions/investments + dedupe
	// + categorização em lote) em vez de esperar o cron diário. Roda em
	// background (waitUntil) pra não travar a resposta do modal; se falhar, o
	// cron pega depois.
	const syncPromise = syncUserItems(db, masterKey, locals.userId).catch((err) => {
		console.error('[onboarding/pluggy] sync pós-conexão falhou', {
			userId: locals.userId,
			error: err instanceof Error ? err.message : String(err)
		});
	});
	platform!.ctx.waitUntil(syncPromise);

	return json({ ok: true });
};
