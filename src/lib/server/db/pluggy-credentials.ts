import { eq } from 'drizzle-orm';
import type { getDb } from './index';
import { pluggyCredentials } from './schema';

type Db = ReturnType<typeof getDb>;

export interface PluggyCredentialsInput {
	userId: string;
	tokenEncrypted: string;
	tokenNonce: string;
	/** Encryption scheme version — see server/crypto.ts. */
	v?: number;
}

export async function getPluggyCredentials(db: Db, userId: string) {
	const [row] = await db
		.select()
		.from(pluggyCredentials)
		.where(eq(pluggyCredentials.userId, userId));
	return row ?? null;
}

export async function upsertPluggyCredentials(db: Db, input: PluggyCredentialsInput) {
	const [saved] = await db
		.insert(pluggyCredentials)
		.values(input)
		.onConflictDoUpdate({
			target: pluggyCredentials.userId,
			set: {
				tokenEncrypted: input.tokenEncrypted,
				tokenNonce: input.tokenNonce,
				v: input.v
			}
		})
		.returning();
	return saved;
}
