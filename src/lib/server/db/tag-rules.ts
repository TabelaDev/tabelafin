// Automatic tag rules — one row per (description, tag): whenever a transaction
// arrives with that exact description, the tag is added automatically. Mirrors
// the categorisation rules, but for the many-to-many tag set: a description can
// map to several tags (several rows), and deleting/re-adding replaces the set.
import { and, eq, isNull } from 'drizzle-orm';
import type { getDb } from './index';
import { transactions, transactionTags } from './schema';
import { tagRules } from './schema';
import { getOrCreateTag } from './tags';

type Db = ReturnType<typeof getDb>;

export interface TagRule {
	id: string;
	description: string;
	tagName: string;
}

export async function getTagRulesByUser(db: Db, userId: string): Promise<TagRule[]> {
	return db
		.select({ id: tagRules.id, description: tagRules.description, tagName: tagRules.tagName })
		.from(tagRules)
		.where(eq(tagRules.userId, userId));
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
