import { and, desc, eq } from 'drizzle-orm';
import type { getDb } from './index';
import { chatConversations, chatMessages } from './schema';

type Db = ReturnType<typeof getDb>;

export async function getConversations(db: Db, userId: string) {
	return db
		.select()
		.from(chatConversations)
		.where(eq(chatConversations.userId, userId))
		.orderBy(desc(chatConversations.updatedAt));
}

export async function getConversation(db: Db, conversationId: string, userId: string) {
	const [conv] = await db
		.select()
		.from(chatConversations)
		.where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
	return conv ?? null;
}

export async function createConversation(db: Db, userId: string, title?: string) {
	const [conv] = await db
		.insert(chatConversations)
		.values({
			userId,
			title: title ?? 'Nova conversa'
		})
		.returning();
	return conv;
}

export async function updateConversationTitle(
	db: Db,
	conversationId: string,
	userId: string,
	title: string
) {
	await db
		.update(chatConversations)
		.set({ title, updatedAt: new Date() })
		.where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
}

export async function deleteConversation(db: Db, conversationId: string, userId: string) {
	await db
		.delete(chatConversations)
		.where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
}

export async function getMessages(db: Db, conversationId: string) {
	return db
		.select()
		.from(chatMessages)
		.where(eq(chatMessages.conversationId, conversationId))
		.orderBy(chatMessages.createdAt);
}

export async function addMessage(
	db: Db,
	conversationId: string,
	role: 'user' | 'assistant',
	content: string
) {
	const [msg] = await db
		.insert(chatMessages)
		.values({
			conversationId,
			role,
			content
		})
		.returning();

	// Update conversation's updatedAt
	await db
		.update(chatConversations)
		.set({ updatedAt: new Date() })
		.where(eq(chatConversations.id, conversationId));

	return msg;
}
