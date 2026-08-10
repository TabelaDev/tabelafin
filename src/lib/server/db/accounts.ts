import { eq } from 'drizzle-orm';
import type { getDb } from './index';
import { financeAccounts as accounts } from './schema';

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
