// Daily cron sync (ESCOPO.md §3.2): pulls accounts/transactions/investments from
// Meu Pluggy (my-api.pluggy.ai) for every pluggy_item of every user, runs the
// dedupe (§5) and fires the batch AI categorisation (§3.3) once per user at the
// end.
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
	updatePluggyFields
} from '$lib/server/db/transactions';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { and, eq, gte, inArray, isNull, notInArray, or } from 'drizzle-orm';
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

	// Grouped by user: the JWT token is per user (ESCOPO.md §2.3), not per item,
	// and the batch categorisation (§3.3) has to run once per user at the end of
	// the sync — never per item and never per transaction.
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

// Syncs one specific user (accounts/transactions/investments + dedupe + batch
// categorisation). Used by the daily cron (through syncAllUsers) and right after
// connecting Open Finance during onboarding, so the data arrives immediately
// instead of waiting for the next run.
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
	const token = await decryptSecret(
		masterKey,
		{
			ciphertext: credentials.tokenEncrypted,
			nonce: credentials.tokenNonce,
			v: credentials.v ?? undefined
		},
		{ purpose: 'pluggy_credentials', userId }
	);

	// Reconciles the items connected in Meu Pluggy (fetchItems) with the local
	// table: upserts new ones (a business account, an Itaú connection added after
	// onboarding) and keeps the existing ones. Without this the sync would never
	// see a new connection — it only processes pluggy_items already stored.
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
			// An item with expired bank credentials or a login error must not block
			// the sync of the user's other items — never log a decrypted token, only
			// enough to debug with.
			console.error('[pluggy/sync] failed to sync item', {
				userId: item.userId,
				itemId: item.id,
				pluggyItemId: item.pluggyItemId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	// Flags as internal transfers the transactions that mirror each other between
	// the user's own accounts (same amount, close dates, different accounts and
	// opposite signs) — a business account into a personal one, Itaú into Nubank.
	// Without this the same money counts twice, as both income and spending.
	await markInternalTransfers(db, userId);

	await categorizeNewTransactions(db, masterKey, userId);
}

// MIRROR_WINDOW_MS: interbank transfers land D+0/D+1, so the two legs can sit
// up to two days apart.
const MIRROR_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

type MirrorRow = { id: string; accountId: string | null; amount: number; date: Date };

// pairMirrors matches each credit against at most one debit of the same amount
// in a different account, and returns the ids of the legs that paired.
//
// The previous version added both sides of every compatible pair, which is the
// cross product, not a matching: three R$50 rows across three accounts within
// the window marked all three, so a genuine expense that merely shared the
// amount with a real transfer disappeared from the dashboard. Pairing greedily
// by closest date consumes each leg exactly once, and anything left over stays
// visible — which is the safe direction to be wrong in.
export function pairMirrors(rows: MirrorRow[]): string[] {
	const credits = rows
		.filter((r) => r.amount > 0)
		.sort((a, b) => a.date.getTime() - b.date.getTime());
	const debits = rows
		.filter((r) => r.amount < 0)
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	const paired: string[] = [];
	const taken = new Set<string>();

	for (const credit of credits) {
		let best: MirrorRow | undefined;
		let bestDistance = Infinity;

		for (const debit of debits) {
			if (taken.has(debit.id)) continue;
			if (debit.accountId === credit.accountId) continue; // same account is not a mirror
			const distance = Math.abs(credit.date.getTime() - debit.date.getTime());
			if (distance <= MIRROR_WINDOW_MS && distance < bestDistance) {
				best = debit;
				bestDistance = distance;
			}
		}

		if (best) {
			taken.add(best.id);
			paired.push(credit.id, best.id);
		}
	}

	return paired;
}

// Detects internal transfers by "mirroring": a transaction on one of the user's
// accounts with amount X that has a counterpart of -X (or the other way round) on
// ANOTHER account of the same user, within a couple of days. When the pair is
// found, both are marked with pluggyCategory='Internal transfer' so the dashboard
// and the report ignore them (see INTERNAL_TRANSFER_CATEGORIES).
async function markInternalTransfers(db: Db, userId: string): Promise<void> {
	// A generous window: transfers between banks can land 1-2 days apart
	// (D+0/D+1). Capped at 60 days so this does not sweep the whole history.
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
				// Only rows not already recognised as internal take part in the
				// pairing — a transaction already flagged by category or description
				// must not "match" another one (the -2000 invoice payment cannot
				// become the mirror of a genuine +2000 of business income).
				//
				// The isNull arms are load-bearing: in SQL `NULL NOT IN (...)`
				// evaluates to NULL, which WHERE treats as false, so a plain
				// notInArray silently dropped every row whose pluggy_category is
				// null — and that column is nullable, so most rows never reached
				// the matching at all.
				or(
					isNull(transactions.pluggyCategory),
					notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES])
				),
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

	// Grouped by absolute amount (rounded to cents). Within a group, looks for
	// pairs on DIFFERENT accounts with opposite signs and dates up to two days
	// apart — the tolerance exists because D+0/D+1 varies between banks. Credit
	// cards are skipped (the invoice payment is already filtered by category).
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

	for (const group of groups.values()) {
		for (const id of pairMirrors(group)) toMark.add(id);
	}

	// One statement instead of one per row: a busy month pairs dozens of legs,
	// and each was its own round trip to D1.
	if (toMark.size > 0) {
		await db
			.update(transactions)
			.set({ pluggyCategory: 'Internal transfer' })
			.where(inArray(transactions.id, [...toMark]));
	}
}

// One batch AI call per user per sync run (ESCOPO.md §3.3), covering every
// transaction still without a category — never one call per transaction. If the
// user has no ai_credentials configured yet (they finished the Pluggy onboarding
// but not the AI one — unlikely, since the onboarding order requires AI first,
// but the sync runs independently of the web session and cannot assume it), the
// transactions stay uncategorised until the next run rather than blocking the
// sync.
async function categorizeNewTransactions(db: Db, masterKey: string, userId: string): Promise<void> {
	const pending = await getUncategorizedTransactions(db, userId);
	if (pending.length === 0) return;

	// The user's automatic rules (description → category) go first: they cover old
	// transactions that landed before the rule existed and they save an AI call.
	// Whatever is still uncategorised afterwards goes to the AI.
	const rules = await getRulesByUser(db, userId);
	if (rules.length > 0) {
		const ruleByDescription = new Map(rules.map((r) => [r.description, r.category]));
		// Group by category so each distinct category is one statement, rather
		// than one per matching transaction.
		const idsByCategory = new Map<string, string[]>();
		for (const tx of pending) {
			const category = ruleByDescription.get(tx.description);
			if (!category) continue;
			const ids = idsByCategory.get(category) ?? [];
			ids.push(tx.id);
			idsByCategory.set(category, ids);
		}
		for (const [category, ids] of idsByCategory) {
			await db
				.update(transactions)
				.set({ category, categorySource: 'rule' })
				.where(inArray(transactions.id, ids));
		}
	}

	const stillPending = await getUncategorizedTransactions(db, userId);
	if (stillPending.length === 0) return;

	// The user's toggle: automatic categorisation off → transactions stay
	// uncategorised until they turn it on (the manual rules already ran above).
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

	const apiKey = await decryptSecret(
		masterKey,
		{
			ciphertext: aiCredentials.keyEncrypted,
			nonce: aiCredentials.nonce,
			v: aiCredentials.v ?? undefined
		},
		{ purpose: 'ai_credentials', userId }
	);

	// The user's own categories — the AI may only choose from these.
	const userCategories = await getCategoriesByUser(db, userId);
	// The user's custom prompt (when configured in /profile/ai).
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

	const idsByAiCategory = new Map<string, string[]>();
	for (const result of results) {
		const ids = idsByAiCategory.get(result.category) ?? [];
		ids.push(result.id);
		idsByAiCategory.set(result.category, ids);
	}
	for (const [category, ids] of idsByAiCategory) {
		await db
			.update(transactions)
			.set({ category, categorySource: 'ai' })
			.where(inArray(transactions.id, ids));
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

		// Incremental window: re-fetching the whole history every night meant the
		// job grew with the account, and every already-known row still cost a
		// lookup. A week of slack covers postings that land retroactively.
		const since = item.lastSyncedAt
			? new Date(item.lastSyncedAt.getTime() - 7 * 24 * 60 * 60 * 1000)
			: undefined;
		const pluggyTransactions = await fetchTransactions(token, [pluggyAccount.id], since);
		for (const tx of pluggyTransactions) {
			const txDate = new Date(tx.date);

			// Already synced on an earlier run: the `pluggyCategory` and `amount` are
			// still refreshed (the BRL-converted amount arrived later — a re-sync
			// fixes foreign transactions stored before that) and the dedupe/supersede
			// is skipped, since it only makes sense for a brand new transaction.
			const alreadySynced = await getTransactionByPluggyId(db, tx.id);
			if (alreadySynced) {
				await updatePluggyFields(db, tx.id, { category: tx.category, amount: tx.amount });
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
			// null = a race with another cron run that inserted it first.
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

	// Investments (XP Wealth and friends, ESCOPO.md §2.3) do not come from
	// /accounts — they are a separate product at Pluggy (see fetchInvestments in
	// client.ts). They become an "account" with type='investment' so they show up
	// in the dashboard balance, with no transactions attached: the investment
	// movements product (investmentsTransactions) is separate and out of MVP
	// scope.
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
