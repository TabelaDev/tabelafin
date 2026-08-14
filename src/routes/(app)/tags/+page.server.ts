import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	deleteTag,
	getOrCreateTag,
	getTagsByUser,
	getTagTotals,
	renameTag
} from '$lib/server/db/tags';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');
	const db = getDb(platform!.env.DB);
	const tags = await getTagTotals(db, locals.userId);
	return { tags };
};

export const actions: Actions = {
	add: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Informe o nome da tag.' });

		const db = getDb(platform!.env.DB);
		const existing = await getTagsByUser(db, locals.userId);
		if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
			return fail(400, { error: `A tag "${name}" já existe.` });
		}
		await getOrCreateTag(db, locals.userId, name);
		return { success: true };
	},

	rename: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const tagId = String(form.get('tagId') ?? '');
		const newName = String(form.get('newName') ?? '').trim();
		if (!tagId || !newName) return fail(400, { error: 'Tag inválida.' });

		const db = getDb(platform!.env.DB);
		await renameTag(db, locals.userId, tagId, newName);
		return { success: true };
	},

	remove: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const tagId = String(form.get('tagId') ?? '');
		if (!tagId) return fail(400, { error: 'Tag inválida.' });

		const db = getDb(platform!.env.DB);
		// Deleting a tag only removes the grouping — transactions keep everything
		// else (categories, amounts).
		await deleteTag(db, locals.userId, tagId);
		return { success: true };
	}
};
