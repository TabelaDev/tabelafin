import { and, eq } from 'drizzle-orm';
import type { getDb } from './index';
import { recurringExpenses } from './schema';

type Db = ReturnType<typeof getDb>;

export interface RecurringExpenseInput {
	description: string;
	amount: number;
	category?: string;
	frequency: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
	nextChargeDate?: Date;
}

export async function getRecurringExpenses(db: Db, userId: string) {
	return db
		.select()
		.from(recurringExpenses)
		.where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.isActive, true)))
		.orderBy(recurringExpenses.description);
}

export async function getAllRecurringExpenses(db: Db, userId: string) {
	return db
		.select()
		.from(recurringExpenses)
		.where(eq(recurringExpenses.userId, userId))
		.orderBy(recurringExpenses.description);
}

export async function createRecurringExpense(db: Db, userId: string, input: RecurringExpenseInput) {
	const [created] = await db
		.insert(recurringExpenses)
		.values({
			userId,
			description: input.description,
			amount: input.amount,
			category: input.category ?? null,
			frequency: input.frequency,
			nextChargeDate: input.nextChargeDate ?? null
		})
		.returning();
	return created;
}

export async function updateRecurringExpense(
	db: Db,
	userId: string,
	id: string,
	input: Partial<RecurringExpenseInput> & { isActive?: boolean }
) {
	const [updated] = await db
		.update(recurringExpenses)
		.set({
			...(input.description !== undefined && { description: input.description }),
			...(input.amount !== undefined && { amount: input.amount }),
			...(input.category !== undefined && { category: input.category }),
			...(input.frequency !== undefined && { frequency: input.frequency }),
			...(input.nextChargeDate !== undefined && { nextChargeDate: input.nextChargeDate }),
			...(input.isActive !== undefined && { isActive: input.isActive }),
			updatedAt: new Date()
		})
		.where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
		.returning();
	return updated;
}

export async function deleteRecurringExpense(db: Db, userId: string, id: string) {
	await db
		.delete(recurringExpenses)
		.where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
}
