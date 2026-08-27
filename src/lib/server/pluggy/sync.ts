// Daily cron sync (ESCOPO.md §3.2): pulls accounts/transactions/investments from
// Meu Pluggy (my-api.pluggy.ai) for every pluggy_item of every user, runs the
// dedupe (§5) and fires the batch AI categorisation (§3.3) once per user at the
// end.
import { AccountType } from '$lib/enums/account-type';
import { categorizeTransactions } from '$lib/server/ai/categorize';
import { categorizeByRules } from '$lib/server/ai/rules';
import { decryptSecret } from '$lib/server/crypto';
import { getDb } from '$lib/server/db';
import { upsertAccount } from '$lib/server/db/accounts';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getRulesByUser } from '$lib/server/db/categorization-rules';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import {
	getAllPluggyItems,
	getPluggyItemsByUser,
	updateLastSyncAttemptAt,
	updateLastSyncedAt,
	upsertPluggyItem
} from '$lib/server/db/pluggy-items';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { applyTagRules } from '$lib/server/db/tag-rules';
import {
	findSupersedeCandidate,
	getExistingPluggyIds,
	getUncategorizedTransactions,
	insertPluggyTransaction,
	markSuperseded,
	updatePluggyFields
} from '$lib/server/db/transactions';
import { getUserAiPrompts } from '$lib/server/db/user-ai-prompts';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { findUserById } from '$lib/server/db/users';
import type { AiProvider } from '$lib/utils/ai-providers';

import { and, eq, gte, inArray, isNull, notInArray, or } from 'drizzle-orm';

import { fetchAccounts, fetchInvestments, fetchItems, fetchTransactions } from './client';
import { computeDedupeHash } from './dedupe';
import {
	INTERNAL_TRANSFER_CATEGORIES,
	INTERNAL_TRANSFER_DESCRIPTIONS,
	isSelfTransferByDescription
} from './internal-transfers';

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
			await syncUserItems(db, env.MASTER_KEY, userId, { items: itemsByUser.get(userId) });
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
export interface SyncUserItemsOptions {
	// Already-loaded items, so the caller does not pay for a second query.
	items?: PluggyItemRow[];
	// Skips the batched AI call at the end. Used by the recovery path in
	// (app)/+layout.server.ts: that runs on a page load, and the user's own BYOK
	// key pays for it — pulling the data is worth doing eagerly, spending their
	// credit is not. The daily cron categorises whatever is left.
	skipAiCategorization?: boolean;
}

export async function syncUserItems(
	db: Db,
	masterKey: string,
	userId: string,
	options: SyncUserItemsOptions = {}
): Promise<void> {
	const { items, skipAiCategorization = false } = options;
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
	// table: upserts new ones (a business account, a connection added after
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
		// Stamped before the try, so a throw still records that we tried — that is
		// what stops the recovery path from retrying on every navigation.
		await updateLastSyncAttemptAt(db, item.id, new Date());
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

	// A synced transaction always has an account — the account is what carries the
	// sign convention (a card purchase arrives positive and IS spending). A row
	// that lost the link silently falls back to the checking convention and shows
	// up as income, so this counts them out loud instead of letting the condition
	// hide. It happened for real: a migration dropped `finance_accounts` before
	// copying `transactions` and ON DELETE SET NULL cascaded over the column.
	await reportOrphanTransactions(db, userId);

	// Flags as internal transfers the transactions that mirror each other between
	// the user's own accounts (same amount, close dates, different accounts and
	// opposite signs) — a business account into a personal one. Without this the
	// same money counts twice, as both income and spending.
	await markInternalTransfers(db, userId);

	// ...and the ones Pluggy mislabels as generic "Transfers"/"Transfer - PIX"
	// even though the description names the user themselves (Pix/TED between own
	// accounts). By-name is deterministic; by-amount pairing alone is too fragile
	// for round amounts that collide with salaries and CDB applications.
	await markSelfTransfersByName(db, userId);

	// Automatic tag rules (description → tag): add the tags the rules describe
	// to every matching transaction. Idempotent — new rules also backfill the
	// history.
	await applyTagRules(db, userId);

	await categorizeNewTransactions(db, masterKey, userId, { skipAi: skipAiCategorization });
}

// Counts synced transactions that have no account linked. Every `source='pluggy'`
// row is inserted with one (insertPluggyTransaction), so a null here is a data
// bug, not a normal case — manual and PDF rows legitimately have none, which is
// why the count is scoped to the pluggy source. Logged rather than repaired: the
// repair belongs to updatePluggyFields, which re-attaches the account on the next
// sync that touches the row. This only makes sure the state is never invisible.
async function reportOrphanTransactions(db: Db, userId: string): Promise<void> {
	const rows = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.source, 'pluggy'),
				isNull(transactions.accountId),
				isNull(transactions.supersededByTransactionId)
			)
		);
	if (rows.length === 0) return;

	// Without an account there is no account type, so classifyMovement falls back to
	// the checking convention and a card purchase reads as income.
	console.error('[pluggy/sync] transações sincronizadas sem conta vinculada', {
		userId,
		count: rows.length,
		impact: 'income/expense sign is wrong for credit card rows'
	});
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
	if (accountIds.size < 2) return; // needs at least 2 accounts for a mirror to exist

	const accountRows = await db
		.select({ id: financeAccounts.id, type: financeAccounts.type })
		.from(financeAccounts)
		.where(and(eq(financeAccounts.userId, userId), inArray(financeAccounts.id, [...accountIds])));

	const accountTypeById = new Map(accountRows.map((a) => [a.id, a.type as AccountType]));

	// Grouped by absolute amount (rounded to cents). Within a group, looks for
	// pairs on DIFFERENT accounts with opposite signs and dates up to two days
	// apart — the tolerance exists because D+0/D+1 varies between banks. Credit
	// cards are skipped (the invoice payment is already filtered by category).
	const groups = new Map<string, (typeof rows)[number][]>();
	for (const row of rows) {
		if (!row.accountId) continue;
		const accType = accountTypeById.get(row.accountId);
		if (accType === AccountType.CreditCard) continue;
		// The grouping key is the integer magnitude. It used to be
		// `.toFixed(2)` on a float — a second, different notion of "same amount"
		// from the one the dedupe used, in the same pipeline.
		const key = String(Math.abs(row.amount));
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

// Marks as internal transfers the transactions whose description names the user
// themselves (Pix/TED between the user's own accounts) — Pluggy labels most as
// "Same person transfer" but slips some as generic "Transfers"/"Transfer - PIX",
// which would otherwise count as income. Scans the whole history (no window):
// once the full name is set, the next sync backfills everything at once.
async function markSelfTransfersByName(db: Db, userId: string): Promise<void> {
	const user = await findUserById(db, userId);
	if (!user || !user.name.trim()) return;

	const rows = await db
		.select({ id: transactions.id, description: transactions.description })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
				// Only rows not already recognised as internal take part — the
				// isNull arms are load-bearing (see markInternalTransfers).
				or(
					isNull(transactions.pluggyCategory),
					notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES])
				)
			)
		);

	const toMark = rows
		.filter((r) => isSelfTransferByDescription(r.description, user.name))
		.map((r) => r.id);
	if (toMark.length > 0) {
		await db
			.update(transactions)
			.set({ pluggyCategory: 'Internal transfer' })
			.where(inArray(transactions.id, toMark));
	}
}

// One batch AI call per user per sync run (ESCOPO.md §3.3), covering every
// transaction still without a category — never one call per transaction. If the
// user has no ai_credentials configured yet (they finished the Pluggy onboarding
// but not the AI one — unlikely, since the onboarding order requires AI first,
// but the sync runs independently of the web session and cannot assume it), the
// transactions stay uncategorised until the next run rather than blocking the
// sync.
async function categorizeNewTransactions(
	db: Db,
	masterKey: string,
	userId: string,
	options: { skipAi?: boolean } = {}
): Promise<void> {
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

	// The offline keyword rules (rules.ts) as a cheap fallback — the same rules
	// the manual /new uses (pix → Transferências, ifood → Alimentação, …). They
	// were never applied to synced transactions, so without AI everything the
	// sync brought stayed "Outros" (a salary Pix, an iFood order, …).
	const byKeyword = await getUncategorizedTransactions(db, userId);
	const idsByRuleCategory = new Map<string, string[]>();
	for (const tx of byKeyword) {
		const category = categorizeByRules(tx.description);
		if (!category) continue;
		const ids = idsByRuleCategory.get(category) ?? [];
		ids.push(tx.id);
		idsByRuleCategory.set(category, ids);
	}
	for (const [category, ids] of idsByRuleCategory) {
		await db
			.update(transactions)
			.set({ category, categorySource: 'rule' })
			.where(inArray(transactions.id, ids));
	}

	const stillPending = await getUncategorizedTransactions(db, userId);
	if (stillPending.length === 0) return;

	// Everything above is free (local keyword and user rules); everything below
	// spends the user's own API credit. The recovery path stops here.
	if (options.skipAi) return;

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

		// One batched lookup instead of a SELECT per transaction. On a first sync
		// — where `since` is undefined and the whole history comes back — that was
		// one round trip per row before any work was done.
		const existingIds = await getExistingPluggyIds(
			db,
			pluggyTransactions.map((tx) => tx.id)
		);

		for (const tx of pluggyTransactions) {
			const txDate = new Date(tx.date);

			// Already synced on an earlier run: the `pluggyCategory`, `amount` and
			// `accountId` are still refreshed (the BRL-converted amount arrived later
			// — a re-sync fixes foreign transactions stored before that, and the
			// account link re-attaches a row that lost it) and the dedupe/supersede is
			// skipped, since it only makes sense for a brand new transaction.
			if (existingIds.has(tx.id)) {
				await updatePluggyFields(db, tx.id, {
					category: tx.category,
					amount: tx.amount,
					accountId: account.id
				});
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

	// Investments (brokerages and funds, ESCOPO.md §2.3) do not come from
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
			type: AccountType.Investment,
			name: investment.name,
			currency: investment.currency,
			cachedBalance: investment.balance
		});
	}
}
