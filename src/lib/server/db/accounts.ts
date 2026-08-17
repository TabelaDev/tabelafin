import { and, eq } from 'drizzle-orm';
import type { getDb } from './index';
import { financeAccounts as accounts, pluggyItems } from './schema';

type Db = ReturnType<typeof getDb>;

export interface AccountInput {
	userId: string;
	pluggyItemId: string;
	pluggyAccountId: string;
	institution: string;
	type: 'checking' | 'credit_card' | 'investment';
	name: string;
	currency: string;
	cachedBalance: number;
}

export async function getAccountsByItem(db: Db, pluggyItemId: string) {
	return db.select().from(accounts).where(eq(accounts.pluggyItemId, pluggyItemId));
}

export async function getAccountsByUser(db: Db, userId: string) {
	return db.select().from(accounts).where(eq(accounts.userId, userId));
}

// Manual accounts, for someone who never connects Open Finance.
//
// Without these the app was unusable in "manual mode" despite the README
// advertising it: `finance_accounts` was only ever written by the Pluggy sync,
// and every balance figure reads exclusively from it — so a user could enter
// two hundred transactions by hand and still see "Saldo total R$ 0,00".
//
// The rows hang off a synthetic `pluggy_items` row rather than making
// `pluggy_item_id` nullable. That column is NOT NULL and `transactions`
// references this table, so relaxing it means a full SQLite table rebuild —
// real risk to real data, buying nothing the sentinel does not already give.
// The sentinel also inherits the existing cascade: deleting the user deletes
// the item, which deletes its accounts.
const MANUAL_INSTITUTION = 'Manual';

async function ensureManualItem(db: Db, userId: string): Promise<string> {
	const pluggyItemId = `manual:${userId}`;
	const [existing] = await db
		.select()
		.from(pluggyItems)
		.where(eq(pluggyItems.pluggyItemId, pluggyItemId));
	if (existing) return existing.id;

	const [created] = await db
		.insert(pluggyItems)
		.values({
			userId,
			pluggyItemId,
			institutionName: MANUAL_INSTITUTION,
			institutionType: 'MANUAL',
			// The sync loop calls fetchAccounts with this id, which Meu Pluggy does
			// not know — the status says plainly that it is not a real connection.
			status: 'MANUAL'
		})
		.returning();
	return created.id;
}

export interface ManualAccountInput {
	userId: string;
	name: string;
	type: 'checking' | 'credit_card' | 'investment';
	balance: number;
}

export async function createManualAccount(db: Db, input: ManualAccountInput) {
	const itemId = await ensureManualItem(db, input.userId);
	const [created] = await db
		.insert(accounts)
		.values({
			userId: input.userId,
			pluggyItemId: itemId,
			// Prefixed so it can never collide with a real Pluggy account id.
			pluggyAccountId: `manual:${crypto.randomUUID()}`,
			institution: MANUAL_INSTITUTION,
			type: input.type,
			name: input.name,
			currency: 'BRL',
			cachedBalance: input.balance
		})
		.returning();
	return created;
}

/** Updates an account's balance. Scoped by userId, so it cannot touch another. */
export async function updateAccountBalance(
	db: Db,
	userId: string,
	accountId: string,
	balance: number
) {
	await db
		.update(accounts)
		.set({ cachedBalance: balance })
		.where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
}

/** Deletes an account. Its transactions survive with `account_id` set to null. */
export async function deleteAccount(db: Db, userId: string, accountId: string) {
	await db.delete(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
}

/** Whether the account was created by hand rather than pulled from Pluggy. */
export function isManualAccount(account: { pluggyAccountId: string }): boolean {
	return account.pluggyAccountId.startsWith('manual:');
}

export async function upsertAccount(db: Db, input: AccountInput) {
	const [saved] = await db
		.insert(accounts)
		.values(input)
		.onConflictDoUpdate({
			target: accounts.pluggyAccountId,
			set: {
				institution: input.institution,
				type: input.type,
				name: input.name,
				currency: input.currency,
				cachedBalance: input.cachedBalance
			}
		})
		.returning();
	return saved;
}
