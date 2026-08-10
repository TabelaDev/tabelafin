// Sync diário via cron (ESCOPO.md §3.2): puxa accounts/transactions/investments
// do Meu Pluggy (my-api.pluggy.ai) pra cada pluggy_item de cada usuário,
// roda o dedupe (§5) e dispara a categorização em lote via IA (§3.3) uma
// vez por usuário no final.
import { getDb } from '$lib/server/db';
import { decryptSecret } from '$lib/server/crypto';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import {
	getAllPluggyItems,
	getPluggyItemsByUser,
	updateLastSyncedAt,
	upsertPluggyItem
} from '$lib/server/db/pluggy-items';
import { upsertAccount } from '$lib/server/db/accounts';
import {
	findSupersedeCandidate,
	getTransactionByPluggyId,
	getUncategorizedTransactions,
	insertPluggyTransaction,
	markSuperseded,
	updatePluggyAmount,
	updatePluggyCategory,
	updateTransactionCategory
} from '$lib/server/db/transactions';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { and, eq, gte, inArray, isNull, notInArray } from 'drizzle-orm';
import { fetchAccounts, fetchInvestments, fetchItems, fetchTransactions } from './client';
import { computeDedupeHash } from './dedupe';
import { categorizeTransactions } from '$lib/server/ai/categorize';
import { getRulesByUser } from '$lib/server/db/categorization-rules';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { getUserAiPrompts } from '$lib/server/db/user-ai-prompts';
import { findUserById } from '$lib/server/db/users';
import { INTERNAL_TRANSFER_CATEGORIES, INTERNAL_TRANSFER_DESCRIPTIONS } from './internal-transfers';
import type { AiProvider } from '$lib/ai-providers';

type Db = ReturnType<typeof getDb>;
type PluggyItemRow = Awaited<ReturnType<typeof getAllPluggyItems>>[number];

export async function syncAllUsers(env: Env): Promise<void> {
	const db = getDb(env.DB);
	const items = await getAllPluggyItems(db);

	// Agrupa por usuário: o JWT token é por usuário (ESCOPO.md §2.3), não
	// por item, e a categorização em lote (§3.3) precisa rodar 1x por usuário
	// no final do sync — nunca por item nem por transação.
	const itemsByUser = new Map<string, PluggyItemRow[]>();
	for (const item of items) {
		const list = itemsByUser.get(item.userId) ?? [];
		list.push(item);
		itemsByUser.set(item.userId, list);
	}

	for (const userId of itemsByUser.keys()) {
		try {
			await syncUserItems(db, env.MASTER_KEY, userId, itemsByUser.get(userId));
		} catch (err) {
			console.error('[pluggy/sync] falha ao sincronizar usuário', {
				userId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}

// Sincroniza um usuário específico (accounts/transactions/investments + dedupe
// + categorização em lote). Usado pelo cron diário (via syncAllUsers) e logo
// após conectar o Open Finance no onboarding, pra trazer os dados na hora em
// vez de esperar a próxima rodada.
export async function syncUserItems(
	db: Db,
	masterKey: string,
	userId: string,
	items?: PluggyItemRow[]
): Promise<void> {
	const credentials = await getPluggyCredentials(db, userId);
	if (!credentials) {
		console.error('[pluggy/sync] usuário sem pluggy_credentials salvas, pulando', { userId });
		return;
	}
	const token = await decryptSecret(masterKey, {
		ciphertext: credentials.tokenEncrypted,
		nonce: credentials.tokenNonce
	});

	// Sincroniza os items conectados no Meu Pluggy (fetchItems) com a tabela
	// local: upserta novos (ex.: conta PJ/MEI, Itaú adicionados depois do
	// onboarding) e mantém os existentes. Sem isso o sync nunca veria uma
	// conexão nova — ele só processa pluggy_items já gravados.
	const pluggyItems = await fetchItems(token);
	for (const pluggyItem of pluggyItems) {
		await upsertPluggyItem(db, {
			userId,
			pluggyItemId: pluggyItem.id,
			institutionName: pluggyItem.institutionName,
			institutionType: pluggyItem.institutionType,
			status: pluggyItem.status
		});
	}

	const userItems = items ?? (await getPluggyItemsByUser(db, userId));

	for (const item of userItems) {
		try {
			await syncItem(db, token, item);
			await updateLastSyncedAt(db, item.id, new Date());
		} catch (err) {
			// Um item com credencial bancária expirada/erro de login não pode
			// travar o sync dos outros items do mesmo usuário — nunca logar token
			// decifrado, só o suficiente pra debugar.
			console.error('[pluggy/sync] falha ao sincronizar item', {
				userId: item.userId,
				itemId: item.id,
				pluggyItemId: item.pluggyItemId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	// Marca como transferência interna as transações que são espelho entre
	// contas do próprio usuário (mesmo valor, datas próximas, contas diferentes
	// e sinais opostos) — ex.: MEI → Nubank PF, Itaú → Nubank. Sem isso o mesmo
	// dinheiro conta duas vezes como receita/gasto.
	await markInternalTransfers(db, userId);

	await categorizeNewTransactions(db, masterKey, userId);
}

// Detecta transferências internas por "espelho": uma transação de uma conta do
// usuário com valor X que tem contraparte de valor -X (ou vice-versa) em OUTRA
// conta do mesmo usuário, em datas próximas (até 2 dias). Quando encontra o
// par, marca ambos com pluggyCategory='Internal transfer' pra que o dashboard
// e o relatório ignorem (ver INTERNAL_TRANSFER_CATEGORIES).
async function markInternalTransfers(db: Db, userId: string): Promise<void> {
	// Janela generosa: transferências entre bancos podem cair com 1-2 dias de
	// diferença (D+0/D+1). Limita em 60 dias pra não varrer histórico infinito.
	const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

	const rows = await db
		.select({
			id: transactions.id,
			accountId: transactions.accountId,
			amount: transactions.amount,
			date: transactions.date
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
				gte(transactions.date, since),
				// Só participa do pareamento quem ainda não é reconhecido como
				// interno — transação já marcada por categoria ou descrição não
				// deve "casar" com outra (ex.: o pagamento de fatura -2000 não
				// pode virar espelho da receita real +2000 da MEI).
				notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES]),
				notInArray(transactions.description, [...INTERNAL_TRANSFER_DESCRIPTIONS])
			)
		);

	if (rows.length === 0) return;

	const accountIds = new Set(
		rows.map((r) => r.accountId).filter((id): id is string => Boolean(id))
	);
	if (accountIds.size < 2) return; // precisa de pelo menos 2 contas pra existir espelho

	const accountRows = await db
		.select({ id: financeAccounts.id, type: financeAccounts.type })
		.from(financeAccounts)
		.where(and(eq(financeAccounts.userId, userId), inArray(financeAccounts.id, [...accountIds])));

	const accountTypeById = new Map(accountRows.map((a) => [a.id, a.type]));

	// Agrupa por valor absoluto (arredondado a centavos). Dentro do grupo,
	// procura pares de contas DIFERENTES com sinais opostos e datas até 2 dias
	// de distância — tolerância porque D+0/D+1 varia entre bancos. Ignora
	// cartão de crédito (pagamento de fatura já é filtrado por categoria).
	const groups = new Map<string, (typeof rows)[number][]>();
	for (const row of rows) {
		if (!row.accountId) continue;
		const accType = accountTypeById.get(row.accountId);
		if (accType === 'credit_card') continue;
		const key = Math.abs(row.amount).toFixed(2);
		const list = groups.get(key) ?? [];
		list.push(row);
		groups.set(key, list);
	}

	const toMark = new Set<string>();
	const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

	for (const group of groups.values()) {
		if (group.length < 2) continue;
		const positives = group.filter((r) => r.amount > 0);
		const negatives = group.filter((r) => r.amount < 0);
		for (const pos of positives) {
			for (const neg of negatives) {
				if (pos.accountId === neg.accountId) continue; // não é espelho: mesma conta
				const diff = Math.abs(pos.date.getTime() - neg.date.getTime());
				if (diff <= TWO_DAYS) {
					toMark.add(pos.id);
					toMark.add(neg.id);
				}
			}
		}
	}

	for (const id of toMark) {
		await db
			.update(transactions)
			.set({ pluggyCategory: 'Internal transfer' })
			.where(eq(transactions.id, id));
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

	// Primeiro aplica as regras automáticas do usuário (descrição → categoria):
	// cobre transações antigas que entraram antes da regra existir e economiza
	// chamada de IA. As que continuarem sem categoria vão pra IA.
	const rules = await getRulesByUser(db, userId);
	if (rules.length > 0) {
		const ruleByDescription = new Map(rules.map((r) => [r.description, r.category]));
		for (const tx of pending) {
			const category = ruleByDescription.get(tx.description);
			if (category) {
				await updateTransactionCategory(db, tx.id, category);
			}
		}
	}

	const stillPending = await getUncategorizedTransactions(db, userId);
	if (stillPending.length === 0) return;

	// Toggle do usuário: categorização automática desligada → transações ficam
	// sem categoria até ele ativar (as regras manuais já foram aplicadas acima).
	const user = await findUserById(db, userId);
	if (user && !user.aiCategorizationEnabled) return;

	const aiCredentials = await getAiCredentials(db, userId);
	if (!aiCredentials) {
		console.error('[pluggy/sync] usuário sem ai_credentials, transações ficam sem categoria', {
			userId,
			pendingCount: stillPending.length
		});
		return;
	}

	const apiKey = await decryptSecret(masterKey, {
		ciphertext: aiCredentials.keyEncrypted,
		nonce: aiCredentials.nonce
	});

	// Categorias dinâmicas do usuário — a IA só pode escolher entre elas.
	const userCategories = await getCategoriesByUser(db, userId);
	// Prompt customizado do usuário (se configurado em /perfil/ia).
	const prompts = await getUserAiPrompts(db, userId);

	const results = await categorizeTransactions({
		provider: aiCredentials.provider as AiProvider,
		model: aiCredentials.model,
		apiKey,
		categories: userCategories.map((c) => c.name),
		customPrompt: prompts.categorizationPrompt ?? undefined,
		transactions: stillPending.map((t) => ({
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

async function syncItem(db: Db, token: string, item: PluggyItemRow): Promise<void> {
	const pluggyAccounts = await fetchAccounts(token, [item.pluggyItemId]);
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

		const pluggyTransactions = await fetchTransactions(token, [pluggyAccount.id]);
		for (const tx of pluggyTransactions) {
			const txDate = new Date(tx.date);

			// Já sincronizada numa rodada anterior: ainda assim atualiza a
			// `pluggyCategory` e o `amount` (o amount convertido pra BRL entrou
			// depois — re-sync corrige transações estrangeiras gravadas antes) e
			// pula o dedupe/supersede, que só faz sentido pra transação nova.
			const alreadySynced = await getTransactionByPluggyId(db, tx.id);
			if (alreadySynced) {
				await updatePluggyCategory(db, tx.id, tx.category);
				await updatePluggyAmount(db, tx.id, tx.amount);
				continue;
			}

			const inserted = await insertPluggyTransaction(db, {
				userId: item.userId,
				accountId: account.id,
				pluggyTransactionId: tx.id,
				date: txDate,
				description: tx.description,
				amount: tx.amount,
				currency: tx.currency,
				pluggyCategory: tx.category,
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
	const pluggyInvestments = await fetchInvestments(token, [item.pluggyItemId]);
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
