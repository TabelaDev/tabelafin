// Sync diário via cron (ESCOPO.md §3.2): puxa accounts/transactions/investments
// da Pluggy pra cada pluggy_item de cada usuário e roda o dedupe (§5). A
// categorização em lote (IA) NÃO acontece aqui — ver TODO pontual abaixo,
// é um pedaço separado, ainda não construído.
import { getDb } from '$lib/server/db';
import { decryptSecret } from '$lib/server/crypto';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getAllPluggyItems, updateLastSyncedAt } from '$lib/server/db/pluggy-items';
import { upsertAccount } from '$lib/server/db/accounts';
import {
	findSupersedeCandidate,
	getTransactionByPluggyId,
	insertPluggyTransaction,
	markSuperseded
} from '$lib/server/db/transactions';
import { getApiKey, fetchAccounts, fetchInvestments, fetchTransactions } from './client';
import { computeDedupeHash } from './dedupe';

type Db = ReturnType<typeof getDb>;
type PluggyItemRow = Awaited<ReturnType<typeof getAllPluggyItems>>[number];

// Cron roda 1x/dia, então bastaria olhar 1-2 dias pra pegar transações novas
// — mas lançamentos (principalmente de cartão de crédito) às vezes demoram
// alguns dias pra aparecer processados no extrato do banco. 35 dias dá
// margem confortável pra isso sem custo relevante (não é um backfill
// histórico completo, só uma janela de segurança pro sync incremental).
const SYNC_WINDOW_DAYS = 35;

export async function syncAllUsers(env: Env): Promise<void> {
	const db = getDb(env.DB);
	const items = await getAllPluggyItems(db);

	// Reusa 1 apiKey por usuário dentro desta rodada — Client ID/Secret é por
	// usuário (ESCOPO.md §2.3), não por item, então não faz sentido autenticar
	// de novo pra cada pluggy_item do mesmo usuário.
	const apiKeyByUser = new Map<string, string>();

	for (const item of items) {
		try {
			let apiKey = apiKeyByUser.get(item.userId);
			if (!apiKey) {
				const credentials = await getPluggyCredentials(db, item.userId);
				if (!credentials) {
					console.error('[pluggy/sync] usuário sem pluggy_credentials salvas, pulando item', {
						userId: item.userId,
						itemId: item.id
					});
					continue;
				}
				const clientId = await decryptSecret(env.MASTER_KEY, {
					ciphertext: credentials.clientIdEncrypted,
					nonce: credentials.clientIdNonce
				});
				const clientSecret = await decryptSecret(env.MASTER_KEY, {
					ciphertext: credentials.clientSecretEncrypted,
					nonce: credentials.clientSecretNonce
				});
				apiKey = await getApiKey(clientId, clientSecret);
				apiKeyByUser.set(item.userId, apiKey);
			}

			await syncItem(db, apiKey, item);
			await updateLastSyncedAt(db, item.id, new Date());
		} catch (err) {
			// Um item com credencial expirada/erro de login não pode travar o
			// sync dos outros usuários/items — nunca logar clientSecret/apiKey
			// decifrados, só o suficiente pra debugar (userId/itemId/mensagem).
			console.error('[pluggy/sync] falha ao sincronizar item', {
				userId: item.userId,
				itemId: item.id,
				pluggyItemId: item.pluggyItemId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}

async function syncItem(db: Db, apiKey: string, item: PluggyItemRow): Promise<void> {
	const from = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);

	const pluggyAccounts = await fetchAccounts(apiKey, item.pluggyItemId);
	for (const pluggyAccount of pluggyAccounts) {
		const account = await upsertAccount(db, {
			userId: item.userId,
			pluggyItemId: item.id,
			pluggyAccountId: pluggyAccount.id,
			institution: item.institutionName,
			type: pluggyAccount.type,
			name: pluggyAccount.name,
			currency: pluggyAccount.currency,
			cachedBalance: pluggyAccount.balance
		});

		const pluggyTransactions = await fetchTransactions(apiKey, pluggyAccount.id, { from });
		for (const tx of pluggyTransactions) {
			const alreadySynced = await getTransactionByPluggyId(db, tx.id);
			if (alreadySynced) continue;

			const txDate = new Date(tx.date);
			const inserted = await insertPluggyTransaction(db, {
				userId: item.userId,
				accountId: account.id,
				pluggyTransactionId: tx.id,
				date: txDate,
				description: tx.description,
				amount: tx.amount,
				currency: tx.currency,
				dedupeHash: computeDedupeHash(account.id, tx.amount, txDate)
			});
			// null = corrida com outra execução do cron que inseriu primeiro.
			if (!inserted) continue;

			const supersedeCandidate = await findSupersedeCandidate(
				db,
				item.userId,
				account.id,
				tx.amount,
				txDate
			);
			if (supersedeCandidate) {
				await markSuperseded(db, supersedeCandidate.id, inserted.id);
			}
		}
	}

	// Investimentos (XP Wealth etc, ESCOPO.md §2.3) não vêm de /accounts — são
	// um produto à parte na Pluggy (ver fetchInvestments em client.ts). Viram
	// uma "conta" com type='investment' pra aparecer no saldo do dashboard,
	// sem transações associadas: o produto de movimentações de investimento
	// (investmentsTransactions) é separado e fica fora do MVP.
	const pluggyInvestments = await fetchInvestments(apiKey, item.pluggyItemId);
	for (const investment of pluggyInvestments) {
		await upsertAccount(db, {
			userId: item.userId,
			pluggyItemId: item.id,
			pluggyAccountId: investment.id,
			institution: item.institutionName,
			type: 'investment',
			name: investment.name,
			currency: investment.currency,
			cachedBalance: investment.balance
		});
	}
}
