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
import {
	applyTagRules,
	deleteTagRule,
	deleteTagRulesByTagName,
	getTagRulesByUser,
	setTagRulesForDescription
} from '$lib/server/db/tag-rules';
import { tags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');
	const db = getDb(platform!.env.DB);

	// Every tag the user owns, merged with the totals — a freshly created tag
	// has no transactions yet, so getTagTotals alone (which joins the junction)
	// would silently hide it from the list.
	const [userTags, totals] = await Promise.all([
		getTagsByUser(db, locals.userId),
		getTagTotals(db, locals.userId)
	]);
	const totalsByTagId = new Map(totals.map((t) => [t.tagId, t]));
	const tags = userTags.map((t) => {
		const total = totalsByTagId.get(t.id);
		return {
			tagId: t.id,
			name: t.name,
			count: total?.count ?? 0,
			expense: total?.expense ?? 0,
			income: total?.income ?? 0
		};
	});

	return { tags, rules: await getTagRulesByUser(db, locals.userId) };
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
		// The rules that referenced this tag name go with it — otherwise the next
		// sync would recreate the tag just to fulfil them.
		const [tag] = await db.select({ name: tags.name }).from(tags).where(eq(tags.id, tagId));
		if (tag) await deleteTagRulesByTagName(db, locals.userId, tag.name);
		// Deleting a tag only removes the grouping — transactions keep everything
		// else (categories, amounts).
		await deleteTag(db, locals.userId, tagId);
		return { success: true };
	},

	// Creates (or replaces) the rule for a description: every future transaction
	// with that exact description gets these tags, and the history is backfilled.
	addRule: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const description = String(form.get('description') ?? '').trim();
		const raw = String(form.get('tags') ?? '');
		const tagNames = raw
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		if (!description) return fail(400, { error: 'Informe a descrição.' });
		if (tagNames.length === 0) return fail(400, { error: 'Escolha ao menos uma tag.' });

		const db = getDb(platform!.env.DB);
		await setTagRulesForDescription(db, locals.userId, description, tagNames);
		await applyTagRules(db, locals.userId);
		return { success: true };
	},

	removeRule: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Regra inválida.' });

		const db = getDb(platform!.env.DB);
		await deleteTagRule(db, locals.userId, id);
		return { success: true };
	}
};
