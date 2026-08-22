import { fail, redirect } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import type { Actions, PageServerLoad } from './$types';
import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import {
	deleteRule,
	getRulesByUser,
	upsertCategorizationRule
} from '$lib/server/db/categorization-rules';
import { getCategoriesByUser } from '$lib/server/db/user-categories';

// Automatic categorisation rules, one per description: the sync applies them to
// incoming transactions (categorySource='rule'). They are created as a side
// effect of categorising — on the detail page, and in bulk when the user
// confirms it — so until this page existed there was nowhere to see what the
// app had been taught, let alone correct it.
export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [rules, categories] = await Promise.all([
		getRulesByUser(db, locals.userId),
		getCategoriesByUser(db, locals.userId)
	]);

	return {
		rules: [...rules].sort((a, b) => a.description.localeCompare(b.description)),
		categories
	};
};

export const actions: Actions = {
	// Creates a brand-new rule from the form on this page — description +
	// category typed by hand. Until this form existed, rules could only be
	// created as a side effect of categorising a transaction.
	add: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const description = String(form.get('description') ?? '').trim();
		const category = String(form.get('category') ?? '').trim();
		if (!description) return fail(400, { error: 'Informe a descrição.' });
		if (!category) return fail(400, { error: 'Escolha uma categoria.' });

		const db = getDb(platform!.env.DB);

		// The category has to be one of the user's own — same guard as update,
		// otherwise the rule could point at a category that nothing renders.
		const categories = await getCategoriesByUser(db, locals.userId);
		if (!categories.some((c) => c.name === category))
			return fail(400, { error: 'Categoria inválida.' });

		await upsertCategorizationRule(db, locals.userId, description, category);
		setFlash(
			{ type: ToastType.success, message: `Regra criada: "${description}" → ${category}.` },
			event
		);
		return { success: true };
	},

	// Retargets a rule at another category. Keyed by description because that is
	// what the rule is keyed by (unique index on user_id + description), so the
	// upsert lands on the same row rather than creating a second one.
	update: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const description = String(form.get('description') ?? '').trim();
		const category = String(form.get('category') ?? '').trim();
		if (!description) return fail(400, { error: 'Regra inválida.' });
		if (!category) return fail(400, { error: 'Escolha uma categoria.' });

		const db = getDb(platform!.env.DB);

		// The category has to be one of the user's own — otherwise a stale form
		// could point the rule at a category that no longer exists, and every
		// future transaction would be filed under a label nothing renders.
		const categories = await getCategoriesByUser(db, locals.userId);
		if (!categories.some((c) => c.name === category))
			return fail(400, { error: 'Categoria inválida.' });

		await upsertCategorizationRule(db, locals.userId, description, category);
		setFlash(
			{ type: ToastType.success, message: `Regra atualizada: "${description}" → ${category}.` },
			event
		);
		return { success: true };
	},

	// Deleting only drops the rule: transactions already categorised by it keep
	// their category. What stops is the app applying it to new ones.
	remove: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Regra inválida.' });

		const db = getDb(platform!.env.DB);
		await deleteRule(db, locals.userId, id);
		setFlash({ type: ToastType.success, message: 'Regra excluída.' }, event);
		return { success: true };
	}
};
