import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { insertManualTransaction } from '$lib/server/db/transactions';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { getTagsByUser, setTransactionTags } from '$lib/server/db/tags';
import { applyTagRules } from '$lib/server/db/tag-rules';
import { categorizeByRules } from '$lib/server/ai/rules';
import { parseCents } from '$lib/lib/money';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');
	const db = getDb(platform!.env.DB);
	const [categories, userTags] = await Promise.all([
		getCategoriesByUser(db, locals.userId),
		getTagsByUser(db, locals.userId)
	]);
	return { categories, userTags };
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const date = form.get('date');
		const description = form.get('description');
		const amount = form.get('amount');
		const category = form.get('category');

		if (typeof date !== 'string' || !date) {
			return fail(400, { error: 'Informe a data.' });
		}
		if (typeof description !== 'string' || !description.trim()) {
			return fail(400, { error: 'Informe a descrição.' });
		}
		// parseCents rather than parseFloat: this is the boundary where a person's
		// "1.234,56" becomes the integer the rest of the app works in. parseFloat
		// also read "1.234,56" as 1.234 — a silent 1000× error for anyone who
		// typed a thousands separator.
		const parsedAmount = parseCents(amount);
		if (parsedAmount === null) {
			return fail(400, { error: 'Informe um valor válido.' });
		}
		const parsedDate = new Date(date + 'T00:00:00.000Z');
		if (isNaN(parsedDate.getTime())) {
			return fail(400, { error: 'Data inválida.' });
		}

		const db = getDb(platform!.env.DB);
		const userCategories = await getCategoriesByUser(db, locals.userId);
		const validCategories = userCategories.map((c) => c.name);

		// When the user picked no category, fall back to the rule-based one.
		const finalCategory: string | null =
			typeof category === 'string' && validCategories.includes(category)
				? category
				: categorizeByRules(description);

		const tagsRaw = form.get('tags');
		const tagNames =
			typeof tagsRaw === 'string'
				? tagsRaw
						.split(',')
						.map((t) => t.trim())
						.filter(Boolean)
				: [];

		const saved = await insertManualTransaction(db, {
			userId: locals.userId,
			date: parsedDate,
			description: description.trim(),
			amount: parsedAmount,
			category: finalCategory
		});

		if (saved && tagNames.length > 0) {
			await setTransactionTags(db, locals.userId, saved.id, tagNames);
		}

		// Automatic tag rules for this description also apply (a manual "Uber"
		// gets the same "Viagem SP" tag the sync would give it).
		await applyTagRules(db, locals.userId);

		redirect(303, '/dashboard');
	}
};
