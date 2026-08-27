// Tags — ad-hoc groupings orthogonal to categories (a one-off "Viagem SP"
// without a category). Manual only: AI/rules never touch tags. A transaction
// carries many tags (junction table `transaction_tags`).
import { AccountType } from '$lib/enums/account-type';

import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';

import type { getDb } from './index';
import { financeAccounts, tags, transactionTags, transactions } from './schema';
import { classifyMovement, isNotInternalTransfer } from './transactions';

type Db = ReturnType<typeof getDb>;

export interface Tag {
	id: string;
	name: string;
}

export async function getTagsByUser(db: Db, userId: string): Promise<Tag[]> {
	return db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(eq(tags.userId, userId))
		.orderBy(tags.name);
}

// Creates the tag if it does not exist yet (dedupe by name), returning it.
export async function getOrCreateTag(db: Db, userId: string, name: string): Promise<Tag> {
	const [existing] = await db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(and(eq(tags.userId, userId), eq(tags.name, name)));
	if (existing) return existing;

	const [created] = await db
		.insert(tags)
		.values({ userId, name })
		.onConflictDoNothing()
		.returning({ id: tags.id, name: tags.name });
	if (created) return created;

	// Lost a concurrent create — read the row the winner wrote. Bounded: the
	// recursive fallback this replaced could spin forever under a driver that
	// returns nothing for an on-conflict insert.
	const [winner] = await db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(and(eq(tags.userId, userId), eq(tags.name, name)));
	if (winner) return winner;
	throw new Error('Não foi possível criar a tag.');
}

export async function renameTag(
	db: Db,
	userId: string,
	tagId: string,
	newName: string
): Promise<void> {
	await db
		.update(tags)
		.set({ name: newName })
		.where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
}

// Deleting a tag cascades to the junction rows (transactions keep everything
// else — only the grouping disappears).
export async function deleteTag(db: Db, userId: string, tagId: string): Promise<void> {
	await db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
}

// Replaces the whole tag set of a transaction (create-on-the-fly included).
// Ownership is checked through the transaction row.
export async function setTransactionTags(
	db: Db,
	userId: string,
	transactionId: string,
	tagNames: string[]
): Promise<void> {
	const [tx] = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
	if (!tx) return;

	const resolved = await Promise.all(
		[...new Set(tagNames.map((n) => n.trim()).filter(Boolean))].map((name) =>
			getOrCreateTag(db, userId, name)
		)
	);

	await db.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
	if (resolved.length > 0) {
		await db
			.insert(transactionTags)
			.values(resolved.map((tag) => ({ transactionId, tagId: tag.id })))
			.onConflictDoNothing();
	}
}

export async function getTagsForTransaction(db: Db, transactionId: string): Promise<Tag[]> {
	const rows = await db
		.select({ id: tags.id, name: tags.name })
		.from(transactionTags)
		.innerJoin(tags, eq(tags.id, transactionTags.tagId))
		.where(eq(transactionTags.transactionId, transactionId))
		.orderBy(tags.name);
	return rows;
}

// Bulk lookup for a list of transactions (the list page) — transaction id → tags.
export async function getTagsForTransactions(
	db: Db,
	transactionIds: string[]
): Promise<Map<string, Tag[]>> {
	const map = new Map<string, Tag[]>();
	if (transactionIds.length === 0) return map;

	// The list page can hand over every transaction the user has (hundreds of
	// ids); D1 caps the bind parameters per statement, so the IN clause is chunked.
	const CHUNK = 90;
	for (let i = 0; i < transactionIds.length; i += CHUNK) {
		const chunk = transactionIds.slice(i, i + CHUNK);
		const rows = await db
			.select({ transactionId: transactionTags.transactionId, id: tags.id, name: tags.name })
			.from(transactionTags)
			.innerJoin(tags, eq(tags.id, transactionTags.tagId))
			.where(inArray(transactionTags.transactionId, chunk))
			.orderBy(tags.name);

		for (const row of rows) {
			const list = map.get(row.transactionId) ?? [];
			list.push({ id: row.id, name: row.name });
			map.set(row.transactionId, list);
		}
	}
	return map;
}

export interface TagTotal {
	tagId: string;
	name: string;
	count: number;
	expense: number; // signed (a refund nets against purchases)
	income: number;
}

// Per-tag aggregate for the /tags page (and the chat/report context): number of
// transactions and the signed expense/income split. Uses the same
// classifyMovement as the dashboard so a tag's totals agree with the category
// totals. `from`/`to` bound the window when provided (chat/report need the
// current month only).
export async function getTagTotals(
	db: Db,
	userId: string,
	from?: Date,
	to?: Date
): Promise<TagTotal[]> {
	const conditions = [
		eq(tags.userId, userId),
		isNull(transactions.supersededByTransactionId),
		isNotInternalTransfer
	];
	if (from) conditions.push(gte(transactions.date, from));
	if (to) conditions.push(lt(transactions.date, to));

	const rows = await db
		.select({
			tagId: tags.id,
			name: tags.name,
			amount: transactions.amount,
			accountType: financeAccounts.type,
			accountId: transactions.accountId
		})
		.from(transactionTags)
		.innerJoin(tags, eq(tags.id, transactionTags.tagId))
		.innerJoin(transactions, eq(transactions.id, transactionTags.transactionId))
		.leftJoin(financeAccounts, eq(financeAccounts.id, transactions.accountId))
		.where(and(...conditions));

	const totals = new Map<string, TagTotal>();
	for (const row of rows) {
		const current = totals.get(row.tagId) ?? {
			tagId: row.tagId,
			name: row.name,
			count: 0,
			expense: 0,
			income: 0
		};
		const { expense, income } = classifyMovement(
			row.accountId ? (row.accountType as AccountType) : undefined,
			row.amount
		);
		current.count += 1;
		current.expense += expense;
		current.income += income;
		totals.set(row.tagId, current);
	}
	return [...totals.values()];
}
