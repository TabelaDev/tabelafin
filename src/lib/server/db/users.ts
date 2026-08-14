import { eq } from 'drizzle-orm';
import type { getDb } from './index';
import { users } from './schema';

type Db = ReturnType<typeof getDb>;

export async function findUserByEmail(db: Db, email: string) {
	const [user] = await db.select().from(users).where(eq(users.email, email));
	return user ?? null;
}

export async function findUserById(db: Db, id: string) {
	const [user] = await db.select().from(users).where(eq(users.id, id));
	return user ?? null;
}

export async function createUser(
	db: Db,
	input: { id: string; name: string; email: string; timezone?: string }
) {
	const [created] = await db
		.insert(users)
		.values({
			id: input.id,
			name: input.name,
			email: input.email,
			timezone: input.timezone ?? 'UTC',
			createdAt: new Date()
		})
		.returning();
	return created;
}

export async function getAllUsers(db: Db) {
	return db.select().from(users);
}

export async function setUserHideAi(db: Db, id: string, hidden: boolean) {
	await db.update(users).set({ hideAi: hidden }).where(eq(users.id, id));
}

export async function setUserSeenOnboarding(db: Db, id: string, seen: boolean) {
	await db.update(users).set({ seenOnboarding: seen }).where(eq(users.id, id));
}

export async function setUserName(db: Db, id: string, name: string) {
	await db.update(users).set({ name }).where(eq(users.id, id));
}

export async function updateUserAiToggles(
	db: Db,
	id: string,
	toggles: { categorization?: boolean; report?: boolean; chat?: boolean }
) {
	await db
		.update(users)
		.set({
			...(toggles.categorization !== undefined && {
				aiCategorizationEnabled: toggles.categorization
			}),
			...(toggles.report !== undefined && { aiReportEnabled: toggles.report }),
			...(toggles.chat !== undefined && { aiChatEnabled: toggles.chat })
		})
		.where(eq(users.id, id));
}
