import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';

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
}
