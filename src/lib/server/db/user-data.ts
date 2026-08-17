// LGPD art. 18 — the two rights that have to be exercisable without asking a
// human: portability/access (export) and elimination (delete).
import { eq, inArray } from 'drizzle-orm';
import type { getDb } from './index';
import {
	categorizationRules,
	chatConversations,
	chatMessages,
	financeAccounts,
	monthlyReports,
	recurringExpenses,
	statementUploads,
	tagRules,
	tags,
	transactions,
	userAiPrompts,
	userCategories,
	users
} from './schema';

type Db = ReturnType<typeof getDb>;

/**
 * Everything the user owns, as plain JSON.
 *
 * Deliberately excludes the encrypted credentials (`ai_credentials`,
 * `pluggy_credentials`) and the auth tables: an export is a file that ends up
 * in a downloads folder, and putting a bank session token in it — even
 * ciphertext — turns a portability feature into a credential-leak channel. The
 * credentials are not the user's *data*; they are keys to someone else's
 * service, and the user already holds the originals.
 */
export async function exportUserData(db: Db, userId: string) {
	const [
		user,
		accounts,
		txs,
		categories,
		rules,
		userTags,
		tagRuleRows,
		recurring,
		reports,
		uploads,
		conversations,
		prompts
	] = await Promise.all([
		db.select().from(users).where(eq(users.id, userId)),
		db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
		db.select().from(transactions).where(eq(transactions.userId, userId)),
		db.select().from(userCategories).where(eq(userCategories.userId, userId)),
		db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId)),
		db.select().from(tags).where(eq(tags.userId, userId)),
		db.select().from(tagRules).where(eq(tagRules.userId, userId)),
		db.select().from(recurringExpenses).where(eq(recurringExpenses.userId, userId)),
		db.select().from(monthlyReports).where(eq(monthlyReports.userId, userId)),
		db.select().from(statementUploads).where(eq(statementUploads.userId, userId)),
		db.select().from(chatConversations).where(eq(chatConversations.userId, userId)),
		db.select().from(userAiPrompts).where(eq(userAiPrompts.userId, userId))
	]);

	// Chat messages hang off conversations, not off the user directly.
	const conversationIds = conversations.map((c) => c.id);
	const messages =
		conversationIds.length > 0
			? await db
					.select()
					.from(chatMessages)
					.where(inArray(chatMessages.conversationId, conversationIds))
			: [];

	const profile = user[0];

	return {
		exportedAt: new Date().toISOString(),
		// Version the shape so a future import path can tell formats apart.
		format: 'tabelafin-export-v1',
		profile: profile
			? { id: profile.id, name: profile.name, email: profile.email, createdAt: profile.createdAt }
			: null,
		accounts,
		transactions: txs,
		categories,
		categorizationRules: rules,
		tags: userTags,
		tagRules: tagRuleRows,
		recurringExpenses: recurring,
		monthlyReports: reports,
		statementUploads: uploads,
		chat: { conversations, messages },
		aiPrompts: prompts
	};
}

/**
 * Deletes the user and, by cascade, everything that references them.
 *
 * Every table carrying a `user_id` declares `onDelete: 'cascade'` against
 * `user.id`, so a single delete is enough — as long as the D1 connection has
 * foreign keys enforced. It does by default, but the two rows this cannot
 * reach through a cascade are handled explicitly first:
 *
 *   - `chat_messages` cascades from `chat_conversations`, not from the user, so
 *     it is covered transitively — no action needed.
 *   - the device token lives in KV, outside the database entirely, and is
 *     revoked by the caller.
 */
export async function deleteUserAccount(db: Db, userId: string): Promise<void> {
	await db.delete(users).where(eq(users.id, userId));
}
