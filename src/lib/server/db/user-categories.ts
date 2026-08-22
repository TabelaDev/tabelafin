import { and, eq } from 'drizzle-orm';
import type { getDb } from './index';
import { userCategories } from './schema';

type Db = ReturnType<typeof getDb>;

export interface UserCategory {
	userId: string;
	name: string;
	color: string;
	createdAt: Date;
}

// The default categories every new user is seeded with on signup — they mirror
// the old TRANSACTION_CATEGORIES + CATEGORY_COLORS.
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
	{ name: 'Alimentação', color: 'ctp-peach' },
	{ name: 'Transporte', color: 'ctp-sky' },
	{ name: 'Moradia', color: 'ctp-mauve' },
	{ name: 'Saúde', color: 'ctp-red' },
	{ name: 'Lazer', color: 'ctp-blue' },
	{ name: 'Compras', color: 'ctp-pink' },
	{ name: 'Educação', color: 'ctp-yellow' },
	{ name: 'Assinaturas', color: 'ctp-sapphire' },
	{ name: 'Investimentos', color: 'ctp-green' },
	{ name: 'Transferências', color: 'ctp-lavender' },
	{ name: 'Renda', color: 'ctp-green' },
	{ name: 'Outros', color: 'ctp-overlay1' }
];

export async function getCategoriesByUser(db: Db, userId: string): Promise<UserCategory[]> {
	return db
		.select()
		.from(userCategories)
		.where(eq(userCategories.userId, userId))
		.orderBy(userCategories.name);
}

export async function getCategory(
	db: Db,
	userId: string,
	name: string
): Promise<UserCategory | null> {
	const [row] = await db
		.select()
		.from(userCategories)
		.where(and(eq(userCategories.userId, userId), eq(userCategories.name, name)));
	return row ?? null;
}

// Inserts the default categories if the user has none yet. Called on
// signup (createUser) — idempotent.
export async function ensureDefaultCategories(db: Db, userId: string): Promise<void> {
	const existing = await getCategoriesByUser(db, userId);
	if (existing.length > 0) return;
	await db
		.insert(userCategories)
		.values(
			DEFAULT_CATEGORIES.map((c) => ({
				userId,
				name: c.name,
				color: c.color
			}))
		)
		.onConflictDoNothing();
}

export async function addCategory(
	db: Db,
	userId: string,
	name: string,
	color: string
): Promise<UserCategory> {
	const [created] = await db
		.insert(userCategories)
		.values({ userId, name, color })
		.onConflictDoNothing()
		.returning();
	return created;
}

export async function updateCategory(
	db: Db,
	userId: string,
	name: string,
	patch: { name?: string; color?: string }
): Promise<void> {
	await db
		.update(userCategories)
		.set({
			name: patch.name,
			color: patch.color
		})
		.where(and(eq(userCategories.userId, userId), eq(userCategories.name, name)));
}

export async function deleteCategory(db: Db, userId: string, name: string): Promise<void> {
	await db
		.delete(userCategories)
		.where(and(eq(userCategories.userId, userId), eq(userCategories.name, name)));
}
