import { eq } from 'drizzle-orm';

import type { getDb } from './index';
import { userAiPrompts } from './schema';

type Db = ReturnType<typeof getDb>;

export interface UserAiPrompts {
	categorizationPrompt: string | null;
	reportPrompt: string | null;
	chatSystemPrompt: string | null;
}

export async function getUserAiPrompts(db: Db, userId: string): Promise<UserAiPrompts> {
	const [row] = await db.select().from(userAiPrompts).where(eq(userAiPrompts.userId, userId));

	return {
		categorizationPrompt: row?.categorizationPrompt ?? null,
		reportPrompt: row?.reportPrompt ?? null,
		chatSystemPrompt: row?.chatSystemPrompt ?? null
	};
}

export async function upsertUserAiPrompts(db: Db, userId: string, prompts: Partial<UserAiPrompts>) {
	const existing = await db.select().from(userAiPrompts).where(eq(userAiPrompts.userId, userId));

	const now = new Date();

	if (existing.length === 0) {
		await db.insert(userAiPrompts).values({
			userId,
			categorizationPrompt: prompts.categorizationPrompt ?? null,
			reportPrompt: prompts.reportPrompt ?? null,
			chatSystemPrompt: prompts.chatSystemPrompt ?? null,
			createdAt: now,
			updatedAt: now
		});
	} else {
		await db
			.update(userAiPrompts)
			.set({
				...(prompts.categorizationPrompt !== undefined && {
					categorizationPrompt: prompts.categorizationPrompt
				}),
				...(prompts.reportPrompt !== undefined && { reportPrompt: prompts.reportPrompt }),
				...(prompts.chatSystemPrompt !== undefined && {
					chatSystemPrompt: prompts.chatSystemPrompt
				}),
				updatedAt: now
			})
			.where(eq(userAiPrompts.userId, userId));
	}
}
