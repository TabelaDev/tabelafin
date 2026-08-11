import { eq } from 'drizzle-orm';
import type { getDb } from './index';
import { aiCredentials } from './schema';
import type { AiProvider } from '$lib/ai-providers';

type Db = ReturnType<typeof getDb>;

export interface AiCredentialsInput {
	userId: string;
	provider: AiProvider;
	model: string;
	keyEncrypted: string;
	nonce: string;
	/** Encryption scheme version — see server/crypto.ts. */
	v?: number;
}

export async function getAiCredentials(db: Db, userId: string) {
	const [row] = await db.select().from(aiCredentials).where(eq(aiCredentials.userId, userId));
	return row ?? null;
}

export async function upsertAiCredentials(db: Db, input: AiCredentialsInput) {
	const [saved] = await db
		.insert(aiCredentials)
		.values(input)
		.onConflictDoUpdate({
			target: aiCredentials.userId,
			set: {
				provider: input.provider,
				model: input.model,
				keyEncrypted: input.keyEncrypted,
				nonce: input.nonce,
				v: input.v
			}
		})
		.returning();
	return saved;
}
