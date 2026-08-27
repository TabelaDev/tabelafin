import { Frequency } from '$lib/enums/frequency';
import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import {
	createRecurringExpense,
	deleteRecurringExpense,
	getAllRecurringExpenses
} from '$lib/server/db/recurring-expenses';
import { transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { requireLogin } from '$lib/server/require-login';
import { parseCents } from '$lib/utils/money';

import { fail } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { setFlash } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

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

	// Normalising a weekly/quarterly/yearly charge to a monthly figure divides,
	// which lands between centavos — rounded per item so the running total stays
	// an integer rather than drifting into fractional cents.
	const monthlyTotal = activeExpenses.reduce((sum, e) => {
		switch (e.frequency) {
			case Frequency.Weekly:
				return sum + Math.round(e.amount * 4.33);
			case Frequency.Quarterly:
				return sum + Math.round(e.amount / 3);
			case Frequency.Yearly:
				return sum + Math.round(e.amount / 12);
			case Frequency.Monthly:
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
		monthlyTotal: monthlyTotal,
		categories: await getCategoriesByUser(db, locals.userId)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

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

		// parseCents: the boundary from what the person typed to the integer the
		// rest of the app uses. parseFloat also mis-read "1.234,56" as 1.234.
		const parsedAmount = parseCents(amount);
		if (parsedAmount === null || parsedAmount <= 0) {
			return fail(400, { error: 'Valor inválido.' });
		}

		const db = getDb(platform!.env.DB);

		await createRecurringExpense(db, locals.userId, {
			description,
			amount: parsedAmount,
			category: typeof category === 'string' ? category : undefined,
			frequency: frequency as Frequency,
			nextChargeDate:
				typeof nextChargeDate === 'string' && nextChargeDate ? new Date(nextChargeDate) : undefined
		});

		setFlash({ type: ToastType.success, message: `Recorrência "${description}" criada.` }, event);
		return { success: true };
	},

	delete: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const id = form.get('id');

		if (typeof id !== 'string') {
			return fail(400, { error: 'ID inválido.' });
		}

		const db = getDb(platform!.env.DB);
		await deleteRecurringExpense(db, locals.userId, id);

		setFlash({ type: ToastType.success, message: 'Recorrência excluída.' }, event);
		return { success: true };
	}
};
