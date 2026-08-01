import { eq } from 'drizzle-orm';
import type { getDb } from './index';
import { pluggyItems } from './schema';

type Db = ReturnType<typeof getDb>;

export interface PluggyItemInput {
	userId: string;
	pluggyItemId: string;
	institutionName: string;
	institutionType: string;
	status: string;
}

export async function getAllPluggyItems(db: Db) {
	return db.select().from(pluggyItems);
}

export async function getPluggyItemsByUser(db: Db, userId: string) {
	return db.select().from(pluggyItems).where(eq(pluggyItems.userId, userId));
}

export async function upsertPluggyItem(db: Db, input: PluggyItemInput) {
	const [saved] = await db
		.insert(pluggyItems)
		.values(input)
		.onConflictDoUpdate({
			target: pluggyItems.pluggyItemId,
			set: {
				institutionName: input.institutionName,
				institutionType: input.institutionType,
				status: input.status
			}
		})
		.returning();
	return saved;
}

export async function updateLastSyncedAt(db: Db, id: string, lastSyncedAt: Date) {
	await db.update(pluggyItems).set({ lastSyncedAt }).where(eq(pluggyItems.id, id));
}
