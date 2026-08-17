import { and, eq, notLike } from 'drizzle-orm';
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

// The synthetic item that manual accounts hang off (see db/accounts.ts) is not
// a Meu Pluggy connection and must never reach the sync: `fetchAccounts` would
// be called with an id the API does not know, failing every night. Worse, it
// would never get a `lastSyncedAt`, so the recovery sync in
// (app)/+layout.server.ts would consider the user permanently un-synced and
// re-fire on every navigation. Excluded at the query, so no caller can forget.
const REAL_ITEMS_ONLY = notLike(pluggyItems.pluggyItemId, 'manual:%');

export async function getAllPluggyItems(db: Db) {
	return db.select().from(pluggyItems).where(REAL_ITEMS_ONLY);
}

export async function getPluggyItemsByUser(db: Db, userId: string) {
	return db
		.select()
		.from(pluggyItems)
		.where(and(eq(pluggyItems.userId, userId), REAL_ITEMS_ONLY));
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

// Recorded before the attempt, so a failing item is distinguishable from one
// that was never tried — see the column comment in schema.ts.
export async function updateLastSyncAttemptAt(db: Db, id: string, lastSyncAttemptAt: Date) {
	await db.update(pluggyItems).set({ lastSyncAttemptAt }).where(eq(pluggyItems.id, id));
}

// Minimum gap between two syncs triggered by a user action rather than by the
// cron. Both triggers can repeat many times a day — every navigation, every
// visit to Meu Pluggy — and a full sync is expensive: a fetch per item plus a
// query per transaction.
export const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

type SyncCooldownItem = { lastSyncedAt: Date | null; lastSyncAttemptAt: Date | null };

function attemptedWithinCooldown(item: SyncCooldownItem, now: Date): boolean {
	if (!item.lastSyncAttemptAt) return false;
	return now.getTime() - item.lastSyncAttemptAt.getTime() < SYNC_COOLDOWN_MS;
}

// (app)/+layout.server.ts — an item that has *never* synced successfully is
// worth catching up on when the user shows up, instead of waiting for the cron.
//
// The two columns have to be read together. `lastSyncedAt` alone never advances
// for an item that keeps failing (expired token, LOGIN_ERROR), so on its own it
// says "sync me" forever; `lastSyncAttemptAt` is stamped even on failure and is
// what turns that into one retry per window rather than one per page view.
export function shouldRecoverySync(items: SyncCooldownItem[], now = new Date()): boolean {
	return items.some((item) => !item.lastSyncedAt && !attemptedWithinCooldown(item, now));
}

// /api/pluggy/token — the extension re-posts a fresh token every time the user
// opens Meu Pluggy, which is a good moment to pull new data. Unlike the recovery
// case this applies to healthy items too (that is the point), so the only guard
// is the cooldown: someone with the tab open all day would otherwise trigger a
// full re-sync on every page load of meu.pluggy.ai.
export function shouldRefreshSync(items: SyncCooldownItem[], now = new Date()): boolean {
	if (items.length === 0) return false;
	return items.some((item) => !attemptedWithinCooldown(item, now));
}
