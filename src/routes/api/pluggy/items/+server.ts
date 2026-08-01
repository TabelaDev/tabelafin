import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { upsertPluggyItem } from '$lib/server/db/pluggy-items';
import { upsertAccount } from '$lib/server/db/accounts';
import { decryptSecret } from '$lib/server/crypto';
import { getApiKey, fetchItem, fetchAccounts, fetchInvestments } from '$lib/server/pluggy/client';

// Chamado pelo componente client-side ($lib/PluggyConnect.svelte) logo depois
// do onSuccess do widget: recebe o itemId que a Pluggy acabou de criar, busca
// os detalhes reais (instituição/status/contas/investimentos) e persiste.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.userId) error(401, 'Não autenticado.');

	const body = (await request.json().catch(() => null)) as { itemId?: unknown } | null;
	if (!body || typeof body.itemId !== 'string' || body.itemId.trim().length === 0) {
		error(400, 'itemId é obrigatório.');
	}
	const itemId = body.itemId;

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

	const pluggyItem = await fetchItem(apiKey, itemId);
	const item = await upsertPluggyItem(db, {
		userId: locals.userId,
		pluggyItemId: pluggyItem.id,
		institutionName: pluggyItem.institutionName,
		institutionType: pluggyItem.institutionType,
		status: pluggyItem.status
	});

	const [pluggyAccounts, pluggyInvestments] = await Promise.all([
		fetchAccounts(apiKey, itemId),
		fetchInvestments(apiKey, itemId)
	]);

	const accountRows = await Promise.all([
		...pluggyAccounts.map((a) =>
			upsertAccount(db, {
				userId: locals.userId!,
				pluggyItemId: item.id,
				pluggyAccountId: a.id,
				institution: pluggyItem.institutionName,
				type: a.type,
				name: a.name,
				currency: a.currency,
				cachedBalance: a.balance
			})
		),
		...pluggyInvestments.map((i) =>
			upsertAccount(db, {
				userId: locals.userId!,
				pluggyItemId: item.id,
				pluggyAccountId: i.id,
				institution: pluggyItem.institutionName,
				type: 'investment',
				name: i.name,
				currency: i.currency,
				cachedBalance: i.balance
			})
		)
	]);

	return json({ accounts: accountRows });
};
