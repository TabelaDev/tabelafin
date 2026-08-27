import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import { tags } from '$lib/server/db/schema';
import { deleteTagRulesByTagName } from '$lib/server/db/tag-rules';
import {
	deleteTag,
	getOrCreateTag,
	getTagTotals,
	getTagsByUser,
	renameTag
} from '$lib/server/db/tags';
import { requireLogin } from '$lib/server/require-login';

import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { setFlash } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();
	const db = getDb(platform!.env.DB);

	const [userTags, totals] = await Promise.all([
		getTagsByUser(db, locals.userId),
		getTagTotals(db, locals.userId)
	]);
	const totalsByTagId = new Map(totals.map((t) => [t.tagId, t]));

	return {
		tags: userTags.map((t) => {
			const total = totalsByTagId.get(t.id);
			return {
				tagId: t.id,
				name: t.name,
				count: total?.count ?? 0,
				expense: total?.expense ?? 0,
				income: total?.income ?? 0
			};
		})
	};
};

export const actions: Actions = {
	add: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Informe o nome da tag.' });

		const db = getDb(platform!.env.DB);
		const existing = await getTagsByUser(db, locals.userId);
		if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
			return fail(400, { error: `A tag "${name}" já existe.` });
		}
		await getOrCreateTag(db, locals.userId, name);
		setFlash({ type: ToastType.success, message: `Tag "${name}" criada.` }, event);
		return { success: true };
	},

	rename: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();
		const form = await request.formData();
		const tagId = String(form.get('tagId') ?? '');
		const newName = String(form.get('newName') ?? '').trim();
		if (!tagId || !newName) return fail(400, { error: 'Tag inválida.' });

		const db = getDb(platform!.env.DB);
		await renameTag(db, locals.userId, tagId, newName);
		setFlash({ type: ToastType.success, message: `Tag renomeada para "${newName}".` }, event);
		return { success: true };
	},

	remove: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();
		const form = await request.formData();
		const tagId = String(form.get('tagId') ?? '');
		if (!tagId) return fail(400, { error: 'Tag inválida.' });

		const db = getDb(platform!.env.DB);
		// The rules that referenced this tag name go with it — otherwise the next
		// sync would recreate the tag just to fulfil them.
		const [tag] = await db.select({ name: tags.name }).from(tags).where(eq(tags.id, tagId));
		if (tag) await deleteTagRulesByTagName(db, locals.userId, tag.name);
		// Deleting a tag only removes the grouping — transactions keep everything
		// else (categories, amounts).
		await deleteTag(db, locals.userId, tagId);
		setFlash(
			{
				type: ToastType.success,
				message: `Tag "${tag?.name ?? ''}" excluída — nenhuma transação foi apagada.`
			},
			event
		);
		return { success: true };
	}
};
