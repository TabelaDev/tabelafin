import { fail, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import {
	getAllRecurringExpenses,
	createRecurringExpense,
	deleteRecurringExpense
} from '$lib/server/db/recurring-expenses';
import { getCategoriesByUser } from '$lib/server/db/user-categories';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const expenses = await getAllRecurringExpenses(db, locals.userId);

	// Counts each recurrence's past occurrences: transactions with the SAME
	// description and amount (subscriptions rarely change; the card sync posts
	// "Mp *Nave 8/12" and the like — so the match is on the fixed name the user
	// registered, by substring, to catch the instalment variants).
	const activeExpenses = expenses.filter((e) => e.isActive);
	const occurrenceCounts: Record<string, number> = {};
	const lastOccurrences: Record<string, Date | null> = {};
	if (activeExpenses.length > 0) {
		const txRows = await db
			.select({ description: transactions.description, date: transactions.date })
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, locals.userId),
					// Only transactions that have not been superseded count as occurrences.
					isNull(transactions.supersededByTransactionId)
				)
			);
		for (const expense of activeExpenses) {
			const lower = expense.description.toLowerCase();
			const matches = txRows.filter((t) => t.description.toLowerCase().includes(lower));
			occurrenceCounts[expense.id] = matches.length;
			if (matches.length > 0) {
				lastOccurrences[expense.id] = new Date(Math.max(...matches.map((m) => m.date.getTime())));
			} else {
				lastOccurrences[expense.id] = null;
			}
		}
	}

	const monthlyTotal = activeExpenses.reduce((sum, e) => {
		switch (e.frequency) {
			case 'weekly':
				return sum + e.amount * 4.33;
			case 'monthly':
				return sum + e.amount;
			case 'quarterly':
				return sum + e.amount / 3;
			case 'yearly':
				return sum + e.amount / 12;
			default:
				return sum + e.amount;
		}
	}, 0);

	return {
		expenses: expenses.map((e) => ({
			...e,
			occurrences: occurrenceCounts[e.id] ?? 0,
			lastOccurrence: lastOccurrences[e.id] ?? null
		})),
		monthlyTotal: Math.round(monthlyTotal * 100) / 100,
		categories: await getCategoriesByUser(db, locals.userId)
	};
};

export const actions: Actions = {
	create: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const description = form.get('description');
		const amount = form.get('amount');
		const category = form.get('category');
		const frequency = form.get('frequency');
		const nextChargeDate = form.get('nextChargeDate');

		if (
			typeof description !== 'string' ||
			typeof amount !== 'string' ||
			typeof frequency !== 'string'
		) {
			return fail(400, { error: 'Preencha os campos obrigatórios.' });
		}

		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) {
			return fail(400, { error: 'Valor inválido.' });
		}

		const db = getDb(platform!.env.DB);

		await createRecurringExpense(db, locals.userId, {
			description,
			amount: parsedAmount,
			category: typeof category === 'string' ? category : undefined,
			frequency: frequency as 'monthly' | 'yearly' | 'weekly' | 'quarterly',
			nextChargeDate:
				typeof nextChargeDate === 'string' && nextChargeDate ? new Date(nextChargeDate) : undefined
		});

		return { success: true };
	},

	delete: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const id = form.get('id');

		if (typeof id !== 'string') {
			return fail(400, { error: 'ID inválido.' });
		}

		const db = getDb(platform!.env.DB);
		await deleteRecurringExpense(db, locals.userId, id);

		return { success: true };
	}
};
