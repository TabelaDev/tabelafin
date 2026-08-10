import { and, eq } from 'drizzle-orm';
import type { getDb } from './index';
import { categorizationRules } from './schema';

type Db = ReturnType<typeof getDb>;

export interface CategorizationRule {
	id: string;
	userId: string;
	description: string;
	category: string;
	createdAt: Date;
}

export async function getRulesByUser(db: Db, userId: string): Promise<CategorizationRule[]> {
	return db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId));
}

// Busca a regra de uma descrição exata (ou null). Usada no sync pra
// categorizar transações novas automaticamente.
export async function getRuleForDescription(
	db: Db,
	userId: string,
	description: string
): Promise<CategorizationRule | null> {
	const [row] = await db
		.select()
		.from(categorizationRules)
		.where(
			and(eq(categorizationRules.userId, userId), eq(categorizationRules.description, description))
		);
	return row ?? null;
}

// Cria ou sobrescreve a regra de uma descrição (uma regra por descrição por
// usuário — unique index em user_id + description). Retorna a regra salva.
export async function upsertCategorizationRule(
	db: Db,
	userId: string,
	description: string,
	category: string
): Promise<CategorizationRule> {
	const [saved] = await db
		.insert(categorizationRules)
		.values({ userId, description, category })
		.onConflictDoUpdate({
			target: [categorizationRules.userId, categorizationRules.description],
			set: { category }
		})
		.returning();
	return saved;
}

export async function deleteRule(db: Db, userId: string, id: string): Promise<void> {
	await db
		.delete(categorizationRules)
		.where(and(eq(categorizationRules.userId, userId), eq(categorizationRules.id, id)));
}

// Deletes the rule that keys on a description, which is how the UI addresses
// it: the detail page knows the transaction, not the rule's id. Without this,
// clearing a category only lasted until the next sync re-applied the rule that
// created it, so re-categorising was impossible.
export async function deleteRuleForDescription(
	db: Db,
	userId: string,
	description: string
): Promise<void> {
	await db
		.delete(categorizationRules)
		.where(
			and(eq(categorizationRules.userId, userId), eq(categorizationRules.description, description))
		);
}
