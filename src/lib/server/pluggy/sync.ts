// Sync diário via cron (ESCOPO.md §3.2): puxa accounts/transactions/investments
// da Pluggy pra cada pluggy_item de cada usuário, roda o dedupe (§5) e dispara
// a categorização em lote via IA (§3.3) uma vez por usuário no final.
import { getDb } from '$lib/server/db';
import { decryptSecret } from '$lib/server/crypto';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { getAllPluggyItems, updateLastSyncedAt } from '$lib/server/db/pluggy-items';
import { upsertAccount } from '$lib/server/db/accounts';
import {
	findSupersedeCandidate,
	getTransactionByPluggyId,
	getUncategorizedTransactions,
	insertPluggyTransaction,
	markSuperseded,
	updateTransactionCategory
} from '$lib/server/db/transactions';
import { getApiKey, fetchAccounts, fetchInvestments, fetchTransactions } from './client';
import { computeDedupeHash } from './dedupe';
import { categorizeTransactions } from '$lib/server/ai/categorize';
import type { AiProvider } from '$lib/ai-providers';

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

	// Agrupa por usuário: Client ID/Secret é por usuário (ESCOPO.md §2.3), não
	// por item, e a categorização em lote (§3.3) precisa rodar 1x por usuário
	// no final do sync — nunca por item nem por transação.
	const itemsByUser = new Map<string, PluggyItemRow[]>();
	for (const item of items) {
		const list = itemsByUser.get(item.userId) ?? [];
		list.push(item);
		itemsByUser.set(item.userId, list);
	}

	for (const [userId, userItems] of itemsByUser) {
		try {
			const credentials = await getPluggyCredentials(db, userId);
			if (!credentials) {
				console.error('[pluggy/sync] usuário sem pluggy_credentials salvas, pulando', { userId });
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
			const apiKey = await getApiKey(clientId, clientSecret);

			for (const item of userItems) {
				try {
					await syncItem(db, apiKey, item);
					await updateLastSyncedAt(db, item.id, new Date());
				} catch (err) {
					// Um item com credencial bancária expirada/erro de login não pode
					// travar o sync dos outros items do mesmo usuário nem dos outros
					// usuários — nunca logar clientSecret/apiKey decifrados, só o
					// suficiente pra debugar.
					console.error('[pluggy/sync] falha ao sincronizar item', {
						userId: item.userId,
						itemId: item.id,
						pluggyItemId: item.pluggyItemId,
						error: err instanceof Error ? err.message : String(err)
					});
				}
			}

			await categorizeNewTransactions(db, env.MASTER_KEY, userId);
		} catch (err) {
			console.error('[pluggy/sync] falha ao sincronizar usuário', {
				userId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}

// Uma chamada de IA em lote por usuário por rodada de sync (ESCOPO.md §3.3),
// cobrindo todas as transações ainda sem categoria — nunca uma chamada por
// transação. Se o usuário não tiver ai_credentials configurado ainda (só
// completou o onboarding de Pluggy, não o de IA — improvável já que a ordem
// do onboarding exige IA primeiro, mas o sync roda independente da sessão web
// e não pode assumir isso), as transações ficam sem categoria até a próxima
// rodada em vez de travar o sync.
async function categorizeNewTransactions(db: Db, masterKey: string, userId: string): Promise<void> {
	const pending = await getUncategorizedTransactions(db, userId);
	if (pending.length === 0) return;

	const aiCredentials = await getAiCredentials(db, userId);
	if (!aiCredentials) {
		console.error('[pluggy/sync] usuário sem ai_credentials, transações ficam sem categoria', {
			userId,
			pendingCount: pending.length
		});
		return;
	}

	const apiKey = await decryptSecret(masterKey, {
		ciphertext: aiCredentials.keyEncrypted,
		nonce: aiCredentials.nonce
	});

	const results = await categorizeTransactions({
		provider: aiCredentials.provider as AiProvider,
		model: aiCredentials.model,
		apiKey,
		transactions: pending.map((t) => ({
			id: t.id,
			description: t.description,
			amount: t.amount,
			date: t.date.toISOString().slice(0, 10)
		}))
	});

	for (const result of results) {
		await updateTransactionCategory(db, result.id, result.category);
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
