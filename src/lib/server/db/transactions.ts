import { and, eq, gte, isNull, lte, ne, notInArray, or } from 'drizzle-orm';
import type { getDb } from './index';
import { transactions } from './schema';
import type { TransactionCategory } from '$lib/lib/categories';
import {
	INTERNAL_TRANSFER_CATEGORIES,
	INTERNAL_TRANSFER_DESCRIPTIONS
} from '$lib/server/pluggy/internal-transfers';
import { getRuleForDescription } from '$lib/server/db/categorization-rules';

type Db = ReturnType<typeof getDb>;

// Internal transfers and investment movements are neither spending nor income —
// filtered out of every summary query (dashboard, categories, reports). Beyond
// the API's category, the description is filtered too ("Pagamento de fatura"
// arrives with the generic "Transfers" category on the checking account, but is
// internal movement). Shared here so every page uses the same predicate.
//
// A NULL `pluggyCategory` (manual/PDF transactions have no API category) must
// NOT be dropped: SQL `NULL NOT IN (…)` evaluates to NULL — falsy — so a plain
// NOT IN would silently hide every hand-typed transaction from the summaries.
export const isNotInternalTransfer = and(
	or(
		isNull(transactions.pluggyCategory),
		notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES])
	),
	or(
		isNull(transactions.description),
		notInArray(transactions.description, [...INTERNAL_TRANSFER_DESCRIPTIONS])
	)
);

// The base condition for "a transaction the user actually sees": their own,
// not superseded (a replaced PDF row never counts). Every user-facing query
// starts from here.
export function visibleTransactions(userId: string) {
	return and(eq(transactions.userId, userId), isNull(transactions.supersededByTransactionId));
}

export interface NewPluggyTransactionInput {
	userId: string;
	accountId: string;
	pluggyTransactionId: string;
	date: Date;
	description: string;
	amount: number;
	currency: string;
	pluggyCategory: string | null;
	dedupeHash: string;
}

export async function getTransactionByPluggyId(db: Db, pluggyTransactionId: string) {
	const [row] = await db
		.select()
		.from(transactions)
		.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
	return row ?? null;
}

// Updates only the `pluggyCategory` of an existing transaction (used by the
// re-sync to backfill the field on transactions that predate it).
// Refreshes the fields the source still owns on an already-synced transaction.
// This was two separate UPDATEs on the same row, run per transaction on every
// sync — the single most repeated round trip in the job.
export async function updatePluggyFields(
	db: Db,
	pluggyTransactionId: string,
	fields: { category: string | null; amount: number }
) {
	await db
		.update(transactions)
		.set({ pluggyCategory: fields.category, amount: fields.amount })
		.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
}

// Inserts a transaction coming from the Pluggy sync. Applies the user's own
// rule (description → category) when one exists, so the row is born already
// categorised (categorySource='rule'). `onConflictDoUpdate` fills in
// `pluggyCategory` when the transaction already exists (e.g. a re-sync after
// the field was added to the schema) — the API's category rarely changes, so
// overwriting is safe. The return value is only read to tell whether this was
// a fresh insert (null = it already existed), to avoid running the
// dedupe/supersede again.
export async function insertPluggyTransaction(db: Db, input: NewPluggyTransactionInput) {
	// The user's rule (created when they categorise a description by hand) takes
	// priority over AI/offline-rule categorisation.
	const rule = await getRuleForDescription(db, input.userId, input.description);

	const [saved] = await db
		.insert(transactions)
		.values({
			userId: input.userId,
			accountId: input.accountId,
			pluggyTransactionId: input.pluggyTransactionId,
			date: input.date,
			description: input.description,
			amount: input.amount,
			currency: input.currency,
			source: 'pluggy',
			pluggyCategory: input.pluggyCategory,
			// The automatic rule is applied on insert; otherwise this is left to the
			// batch categorisation (AI/offline rules) at the end of the sync.
			category: rule?.category ?? null,
			categorySource: rule ? 'rule' : null,
			dedupeHash: input.dedupeHash
		})
		.onConflictDoUpdate({
			target: transactions.pluggyTransactionId,
			set: {
				pluggyCategory: input.pluggyCategory
			}
		})
		.returning();
	return saved ?? null;
}

export interface NewPdfTransactionInput {
	userId: string;
	statementUploadId: string;
	date: Date;
	description: string;
	amount: number;
	currency: string;
	category: TransactionCategory;
}

// Inserts a transaction extracted from a PDF upload (manual fallback). It
// arrives already categorised — extraction and categorisation happen in the
// same AI request (ESCOPO.md §2.4) — so categorySource='ai' here and no later
// batch pass touches it again (the batch only looks at rows with category IS
// NULL). dedupeHash stays null: with no account linked there is no valid
// dedupe key, and the supersede rule (findSupersedeCandidate) compares
// account/amount/date directly, without the hash.
export async function insertPdfTransaction(db: Db, input: NewPdfTransactionInput) {
	// A statement almost always overlaps what the sync already has, so the row
	// is checked against existing transactions before it lands and is born
	// superseded when one already covers it. It is still written — the upload
	// stays auditable through statement_upload_id — but every list filters on
	// supersededByTransactionId IS NULL, so it does not double-count.
	const covering = await findTransactionCoveringPdfRow(db, input.userId, input.amount, input.date);

	const [saved] = await db
		.insert(transactions)
		.values({
			userId: input.userId,
			statementUploadId: input.statementUploadId,
			date: input.date,
			description: input.description,
			amount: input.amount,
			currency: input.currency,
			source: 'pdf_upload',
			category: input.category,
			categorySource: 'ai',
			dedupeHash: null,
			supersededByTransactionId: covering?.id ?? null
		})
		.returning();
	return { transaction: saved, supersededBy: covering?.id ?? null };
}

export interface NewManualTransactionInput {
	userId: string;
	date: Date;
	description: string;
	amount: number;
	category: TransactionCategory | null;
}

// Inserts a transaction typed in by the user. It may arrive with a category
// (typed or suggested by rules) or without one (NULL until a later
// categorisation). categorySource='user' when the user chose it, null when it
// was left uncategorised.
export async function insertManualTransaction(db: Db, input: NewManualTransactionInput) {
	const [saved] = await db
		.insert(transactions)
		.values({
			userId: input.userId,
			date: input.date,
			description: input.description,
			amount: input.amount,
			currency: 'BRL',
			source: 'manual',
			category: input.category,
			categorySource: input.category ? 'user' : null,
			dedupeHash: null
		})
		.returning();
	return saved;
}

// ESCOPO.md §5 — the dedupe rule: a transaction that came from a PDF (and has
// not been superseded yet) is a duplicate candidate for a new Pluggy transaction
// when the amount matches, the date is within ±3 days, and either the account
// matches or the PDF row had no account linked — accountId is nullable on
// transactions for exactly this case, see schema.ts.
const SUPERSEDE_TOLERANCE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function findSupersedeCandidate(
	db: Db,
	userId: string,
	accountId: string,
	amount: number,
	date: Date
) {
	const from = new Date(date.getTime() - SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
	const to = new Date(date.getTime() + SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
	const [row] = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.source, 'pdf_upload'),
				eq(transactions.amount, amount),
				isNull(transactions.supersededByTransactionId),
				gte(transactions.date, from),
				lte(transactions.date, to),
				or(eq(transactions.accountId, accountId), isNull(transactions.accountId))
			)
		);
	return row ?? null;
}

// Same window and amount rule as findSupersedeCandidate, as pure predicates so
// the ingestion path can be tested without a database.
//
// Amounts are compared on magnitude because the two sides disagree on sign: the
// PDF extractor reports an expense as negative (checking-account convention),
// while the API reports a credit card purchase as positive. Matching the exact
// value would therefore have missed every card duplicate — which is most of
// them, since card invoices are what arrives as a statement.
export function amountsMatchForDedupe(a: number, b: number): boolean {
	return Math.abs(a) === Math.abs(b);
}

export function isWithinSupersedeWindow(a: Date, b: Date): boolean {
	return Math.abs(a.getTime() - b.getTime()) <= SUPERSEDE_TOLERANCE_DAYS * DAY_MS;
}

// The mirror of findSupersedeCandidate: given a row about to be inserted from a
// PDF, is it already covered by something the user has?
//
// findSupersedeCandidate only ever runs forward — a new API transaction looks
// back for a PDF row it supersedes — so importing statements for a period the
// sync had already covered inserted a second copy of everything, silently and
// with nothing to run afterwards to clean it up.
export async function findTransactionCoveringPdfRow(
	db: Db,
	userId: string,
	amount: number,
	date: Date
) {
	const from = new Date(date.getTime() - SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
	const to = new Date(date.getTime() + SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
	const candidates = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				// Only rows the user already has from elsewhere count as coverage —
				// matching another PDF row would chain uploads together.
				ne(transactions.source, 'pdf_upload'),
				isNull(transactions.supersededByTransactionId),
				gte(transactions.date, from),
				lte(transactions.date, to)
			)
		);
	return candidates.find((row) => amountsMatchForDedupe(row.amount, amount)) ?? null;
}

export async function markSuperseded(
	db: Db,
	oldTransactionId: string,
	newTransactionId: string
): Promise<void> {
	await db
		.update(transactions)
		.set({ supersededByTransactionId: newTransactionId })
		.where(eq(transactions.id, oldTransactionId));
}

// Transactions ready for a categorisation batch (ESCOPO.md §3.3): no category
// yet and not superseded (a replaced PDF row never needs its own category — it
// disappears from the screens either way).
export async function getUncategorizedTransactions(db: Db, userId: string) {
	return db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.category),
				isNull(transactions.supersededByTransactionId)
			)
		);
}

// A user's transactions in the interval [from, to) — used by the monthly report
// (server/reports/generate.ts). `to` is exclusive on purpose (see
// the caller: it passes the first day of the following month). Excludes
// internal transfers and investment movements — neither spending nor income
// (the API category plus the description, e.g. "Pagamento de fatura").
export async function getTransactionsInRange(db: Db, userId: string, from: Date, to: Date) {
	return db
		.select()
		.from(transactions)
		.where(
			and(
				visibleTransactions(userId),
				isNotInternalTransfer,
				gte(transactions.date, from),
				lte(transactions.date, new Date(to.getTime() - 1))
			)
		);
}
