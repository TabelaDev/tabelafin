import { and, eq, isNull, ne } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import {
	createRecurringExpense,
	getActiveRecurringExpenseByDescription,
	updateRecurringExpense
} from '$lib/server/db/recurring-expenses';
import { deleteRuleForDescription } from '$lib/server/db/categorization-rules';
import { upsertCategorizationRule } from '$lib/server/db/categorization-rules';
import { getTagsByUser, getTagsForTransaction, setTransactionTags } from '$lib/server/db/tags';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);

	const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
	if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

	const account = tx.accountId
		? await db
				.select()
				.from(financeAccounts)
				.where(eq(financeAccounts.id, tx.accountId))
				.then((r) => r[0] ?? null)
		: null;

	const categories = await getCategoriesByUser(db, locals.userId);

	const [userTags, txTags] = await Promise.all([
		getTagsByUser(db, locals.userId),
		getTagsForTransaction(db, params.id)
	]);

	// Drives the recurrence card's state. Because it matches on description, the
	// card reads "already created" on every transaction sharing that
	// description — which is the point: the recurrence describes the charge, not
	// this one occurrence of it.
	const recurrence = await getActiveRecurringExpenseByDescription(
		db,
		locals.userId,
		tx.description
	);

	return {
		recurrence: recurrence
			? {
					id: recurrence.id,
					frequency: recurrence.frequency,
					amount: recurrence.amount,
					createdAt: recurrence.createdAt
				}
			: null,
		transaction: {
			...tx,
			// For display, credit card transactions have their sign flipped: a positive
			// purchase in the API is spending (shown negative); a negative refund is
			// money back (shown positive). Flipped unconditionally.
			displayAmount: account?.type === 'credit_card' ? -tx.amount : tx.amount
		},
		account: account
			? { name: account.name, institution: account.institution, type: account.type }
			: null,
		categories,
		userTags: userTags.map((t) => t.name),
		tags: txTags.map((t) => t.name)
	};
};

export const actions: Actions = {
	categorize: async ({ request, locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const category = String(form.get('category') ?? '').trim();
		if (!category) return { error: 'Selecione uma categoria.' };

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		// Manually categorised — never overwritten by AI/rules.
		await db
			.update(transactions)
			.set({ category, categorySource: 'user' })
			.where(eq(transactions.id, tx.id));

		// Retroactively applies the same category to EVERY past transaction with the
		// SAME description that is still uncategorised — the user has just taught the
		// app something and expects the history to agree ("Psicólogo" for all the
		// appointments). The current transaction was already set to 'user'; the rest
		// become 'rule'.
		await db
			.update(transactions)
			.set({ category, categorySource: 'rule' })
			.where(
				and(
					eq(transactions.userId, locals.userId),
					eq(transactions.description, tx.description),
					isNull(transactions.category),
					ne(transactions.id, tx.id)
				)
			);

		// Creates the automatic rule: every future transaction with the SAME
		// description is born categorised (applied by the sync, categorySource='rule').
		await upsertCategorizationRule(db, locals.userId, tx.description, category);

		return { success: true };
	},

	// Turns the transaction into a recurrence: creates a recurring expense with the
	// same description, the absolute amount and the category. The frequency comes
	// from the form (monthly by default).
	recurring: async ({ request, locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const frequency = String(form.get('frequency') ?? 'monthly');
		const nextChargeDate = form.get('nextChargeDate');
		const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly'];
		// `fail` rather than a bare `{ error }`: the form only surfaces the
		// message when result.type is 'failure', and a plain return counts as a
		// success — so the card announced "Recorrência criada." for a rejected
		// submit.
		if (!validFrequencies.includes(frequency)) {
			return fail(400, { error: 'Frequência inválida.' });
		}

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		// Nothing stopped this from running twice — the card kept offering the
		// form after a successful submit, so a second click minted a duplicate
		// recurrence for the same description.
		const existing = await getActiveRecurringExpenseByDescription(
			db,
			locals.userId,
			tx.description
		);
		if (existing)
			return fail(409, { error: 'Já existe uma recorrência ativa para esta descrição.' });

		// Absolute amount (recurrence is always a fixed expense/outflow).
		const amount = Math.abs(tx.amount);

		await createRecurringExpense(db, locals.userId, {
			description: tx.description,
			amount,
			category: tx.category ?? undefined,
			frequency: frequency as 'monthly' | 'yearly' | 'weekly' | 'quarterly',
			nextChargeDate:
				typeof nextChargeDate === 'string' && nextChargeDate ? new Date(nextChargeDate) : undefined
		});

		return { success: true };
	},

	// Deactivates the recurrence for this description (soft delete, so the
	// history of what was tracked survives). It is shared by every transaction
	// with that description, which the card says out loud before offering this.
	removeRecurrence: async ({ locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		const existing = await getActiveRecurringExpenseByDescription(
			db,
			locals.userId,
			tx.description
		);
		if (!existing) return fail(404, { error: 'Nenhuma recorrência ativa para esta descrição.' });

		await updateRecurringExpense(db, locals.userId, existing.id, { isActive: false });
		return { success: true };
	},

	// Clears the transaction's category (uncategorised again). Used by the
	// categorise card when the user wants to recategorise — it has to be cleared
	// before another one can be chosen.
	removeCategory: async ({ locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		await db
			.update(transactions)
			.set({ category: null, categorySource: null })
			.where(eq(transactions.id, tx.id));

		// The rule goes with it. Clearing only the transaction left the rule that
		// had been created alongside it, and the next sync re-applied the same
		// category — so "Remover" could not actually lead to re-categorising.
		await deleteRuleForDescription(db, locals.userId, tx.description);

		return { success: true };
	},

	// Replaces the transaction's tag set (the TagInput submits them as a
	// comma-separated value). Creates tags on the fly, never touches categories.
	tags: async ({ request, locals, platform, params }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const raw = String(form.get('tags') ?? '');
		const tagNames = raw
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		const db = getDb(platform!.env.DB);
		const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id));
		if (!tx || tx.userId !== locals.userId) error(404, 'Transação não encontrada');

		await setTransactionTags(db, locals.userId, tx.id, tagNames);
		return { success: true };
	}
};
