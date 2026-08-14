import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { insertManualTransaction } from '$lib/server/db/transactions';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { getTagsByUser, setTransactionTags } from '$lib/server/db/tags';
import { categorizeByRules } from '$lib/server/ai/rules';

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
		if (typeof amount !== 'string' || isNaN(parseFloat(amount))) {
			return fail(400, { error: 'Informe um valor válido.' });
		}

		const parsedAmount = parseFloat(amount);
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

		redirect(303, '/dashboard');
	}
};
