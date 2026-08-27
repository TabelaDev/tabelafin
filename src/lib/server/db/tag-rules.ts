// Automatic tag rules — one row per (description, tag): whenever a transaction
// arrives with that exact description, the tag is added automatically. Mirrors
// the categorisation rules, but for the many-to-many tag set: a description can
// map to several tags (several rows), and deleting/re-adding replaces the set.
import { and, eq, isNull } from 'drizzle-orm';

import type { getDb } from './index';
import { transactionTags, transactions } from './schema';
import { tagRules } from './schema';
import { getOrCreateTag } from './tags';

type Db = ReturnType<typeof getDb>;

export interface TagRule {
	id: string;
	description: string;
	tagName: string;
	createdAt: Date;
}

export async function getTagRulesByUser(db: Db, userId: string): Promise<TagRule[]> {
	return db
		.select({
			id: tagRules.id,
			description: tagRules.description,
			tagName: tagRules.tagName,
			createdAt: tagRules.createdAt
		})
		.from(tagRules)
		.where(eq(tagRules.userId, userId));
}

/** One entry per description, with every tag it maps to. */
export interface GroupedTagRule {
	description: string;
	tagNames: string[];
	createdAt: Date;
}

// The table holds one row per (description, tag), unlike categorization_rules
// which is one row per description. A list keyed by row id would therefore show
// the same description N times — once per tag. Grouping is what makes the rules
// page read (and edit) the way the categories one does: a description mapped to a
// set of tags. `createdAt` is the earliest of the group, since that is when the
// rule for that description started existing.
export async function getGroupedTagRulesByUser(db: Db, userId: string): Promise<GroupedTagRule[]> {
	const rows = await getTagRulesByUser(db, userId);

	const byDescription = new Map<string, GroupedTagRule>();
	for (const row of rows) {
		const entry = byDescription.get(row.description);
		if (!entry) {
			byDescription.set(row.description, {
				description: row.description,
				tagNames: [row.tagName],
				createdAt: row.createdAt
			});
			continue;
		}
		entry.tagNames.push(row.tagName);
		if (row.createdAt < entry.createdAt) entry.createdAt = row.createdAt;
	}

	for (const entry of byDescription.values()) entry.tagNames.sort((a, b) => a.localeCompare(b));
	return [...byDescription.values()].sort((a, b) => a.description.localeCompare(b.description));
}

// How many of the user's transactions a rule for this description reaches. Only
// used to say so out loud: creating a rule backfills the whole history
// (applyTagRules), and that used to happen with no indication at all.
export async function countTransactionsForDescription(
	db: Db,
	userId: string,
	description: string
): Promise<number> {
	const rows = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.description, description),
				isNull(transactions.supersededByTransactionId)
			)
		);
	return rows.length;
}

/** Drops every rule for a description (the whole tag set at once). */
export async function deleteTagRulesForDescription(
	db: Db,
	userId: string,
	description: string
): Promise<void> {
	await db
		.delete(tagRules)
		.where(and(eq(tagRules.userId, userId), eq(tagRules.description, description)));
}

export async function getTagRulesForDescription(
	db: Db,
	userId: string,
	description: string
): Promise<string[]> {
	const rows = await db
		.select({ tagName: tagRules.tagName })
		.from(tagRules)
		.where(and(eq(tagRules.userId, userId), eq(tagRules.description, description)));
	return rows.map((r) => r.tagName);
}

// Replaces the whole tag set a description maps to (delete old rows, insert the
// new ones). Used when the detail page saves the Tags card with "criar regra".
export async function setTagRulesForDescription(
	db: Db,
	userId: string,
	description: string,
	tagNames: string[]
): Promise<void> {
	const names = [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))];
	await db
		.delete(tagRules)
		.where(and(eq(tagRules.userId, userId), eq(tagRules.description, description)));
	if (names.length > 0) {
		await db.insert(tagRules).values(names.map((tagName) => ({ userId, description, tagName })));
	}
}

export async function deleteTagRule(db: Db, userId: string, id: string): Promise<void> {
	await db.delete(tagRules).where(and(eq(tagRules.id, id), eq(tagRules.userId, userId)));
}

// When a tag is deleted, its rules go with it — otherwise the next sync would
// recreate the tag just to fulfil a rule that references a name nobody wanted.
export async function deleteTagRulesByTagName(
	db: Db,
	userId: string,
	tagName: string
): Promise<void> {
	await db.delete(tagRules).where(and(eq(tagRules.userId, userId), eq(tagRules.tagName, tagName)));
}

// Applies every tag rule to the user's transactions: for each rule, adds its
// tag to every transaction whose description matches and that does not already
// carry it. Idempotent (the junction primary key dedupes), so running it on
// every sync is safe — and a newly created rule retroactively tags the history,
// the same way categorisation rules do.
export async function applyTagRules(db: Db, userId: string): Promise<void> {
	const rules = await getTagRulesByUser(db, userId);
	if (rules.length === 0) return;

	const tagNames = [...new Set(rules.map((r) => r.tagName))];
	const tagIds = new Map<string, string>();
	for (const name of tagNames) {
		const tag = await getOrCreateTag(db, userId, name);
		tagIds.set(name, tag.id);
	}

	const rows = await db
		.select({ id: transactions.id, description: transactions.description })
		.from(transactions)
		.where(and(eq(transactions.userId, userId), isNull(transactions.supersededByTransactionId)));

	const txIdsByDescription = new Map<string, string[]>();
	for (const row of rows) {
		const list = txIdsByDescription.get(row.description) ?? [];
		list.push(row.id);
		txIdsByDescription.set(row.description, list);
	}

	for (const rule of rules) {
		const tagId = tagIds.get(rule.tagName);
		const txIds = txIdsByDescription.get(rule.description);
		if (!tagId || !txIds || txIds.length === 0) continue;
		await db
			.insert(transactionTags)
			.values(txIds.map((transactionId) => ({ transactionId, tagId })))
			.onConflictDoNothing();
	}
}
