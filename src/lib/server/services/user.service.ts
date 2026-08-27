import { getDb } from '$lib/server/db';
import {
	aiCredentials,
	categorizationRules,
	chatConversations,
	financeAccounts,
	monthlyReports,
	pluggyCredentials,
	pluggyItems,
	pushSubscriptions,
	recurringExpenses,
	statementReviews,
	statementUploads,
	tags,
	transactions,
	userAiPrompts,
	userCategories,
	users
} from '$lib/server/db/schema';

import { eq } from 'drizzle-orm';

type Db = ReturnType<typeof getDb>;

export interface CreateUserInput {
	id: string;
	name: string;
	email: string;
	timezone?: string;
}

export interface AiToggles {
	categorization?: boolean;
	report?: boolean;
	chat?: boolean;
}

export class UserService {
	constructor(private db: Db) {}

	async findById(id: string) {
		const [user] = await this.db.select().from(users).where(eq(users.id, id));
		return user ?? null;
	}

	async findByEmail(email: string) {
		const [user] = await this.db.select().from(users).where(eq(users.email, email));
		return user ?? null;
	}

	async create(input: CreateUserInput) {
		const [created] = await this.db
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

	async getAll() {
		return this.db.select().from(users);
	}

	async setHideAi(id: string, hidden: boolean) {
		await this.db.update(users).set({ hideAi: hidden }).where(eq(users.id, id));
	}

	async setSeenOnboarding(id: string, seen: boolean) {
		await this.db.update(users).set({ seenOnboarding: seen }).where(eq(users.id, id));
	}

	async updateName(id: string, name: string) {
		await this.db.update(users).set({ name }).where(eq(users.id, id));
	}

	async updateAiToggles(id: string, toggles: AiToggles) {
		await this.db
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

	async deleteAccount(id: string) {
		await this.db.delete(users).where(eq(users.id, id));
	}

	async eraseUserData(id: string) {
		await this.db.delete(transactions).where(eq(transactions.userId, id));
		await this.db.delete(financeAccounts).where(eq(financeAccounts.userId, id));
		await this.db.delete(pluggyItems).where(eq(pluggyItems.userId, id));
		await this.db.delete(pluggyCredentials).where(eq(pluggyCredentials.userId, id));
		await this.db.delete(aiCredentials).where(eq(aiCredentials.userId, id));
		await this.db.delete(statementUploads).where(eq(statementUploads.userId, id));
		await this.db.delete(statementReviews).where(eq(statementReviews.userId, id));
		await this.db.delete(monthlyReports).where(eq(monthlyReports.userId, id));
		await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));
		await this.db.delete(userAiPrompts).where(eq(userAiPrompts.userId, id));
		await this.db.delete(recurringExpenses).where(eq(recurringExpenses.userId, id));
		await this.db.delete(chatConversations).where(eq(chatConversations.userId, id));
		await this.db.delete(userCategories).where(eq(userCategories.userId, id));
		await this.db.delete(categorizationRules).where(eq(categorizationRules.userId, id));
		await this.db.delete(tags).where(eq(tags.userId, id));
	}
}
