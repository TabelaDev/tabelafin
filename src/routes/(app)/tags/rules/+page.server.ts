import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import {
	applyTagRules,
	countTransactionsForDescription,
	deleteTagRulesForDescription,
	getGroupedTagRulesByUser,
	setTagRulesForDescription
} from '$lib/server/db/tag-rules';
import { getTagsByUser } from '$lib/server/db/tags';
import { requireLogin } from '$lib/server/require-login';

import { fail } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';

// Automatic tag rules, keyed by description: whenever a transaction with that
// exact description shows up, it gets these tags — and creating a rule backfills
// the history too. These used to be an unsorted, unsearchable, uneditable list
// tacked onto the bottom of /tags; this route mirrors /categories/rules instead.
export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const [rules, tags] = await Promise.all([
		getGroupedTagRulesByUser(db, locals.userId),
		getTagsByUser(db, locals.userId)
	]);

	return { rules, tags: tags.map((t) => t.name) };
};

function parseTagNames(raw: FormDataEntryValue | null): string[] {
	return String(raw ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
}

export const actions: Actions = {
	add: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const description = String(form.get('description') ?? '').trim();
		const tagNames = parseTagNames(form.get('tags'));
		if (!description) return fail(400, { error: 'Informe a descrição.' });
		if (tagNames.length === 0) return fail(400, { error: 'Escolha ao menos uma tag.' });

		const db = getDb(platform!.env.DB);
		await setTagRulesForDescription(db, locals.userId, description, tagNames);
		await applyTagRules(db, locals.userId);

		// The backfill is the part worth saying out loud: this reaches the whole
		// history, not just future transactions, and it used to happen silently.
		const affected = await countTransactionsForDescription(db, locals.userId, description);
		setFlash(
			{
				type: ToastType.success,
				message: `Regra criada para "${description}" — ${affected} transação${
					affected === 1 ? '' : 'ões'
				} marcada${affected === 1 ? '' : 's'}.`
			},
			event
		);
		return { success: true };
	},

	// Replaces the whole tag set of a description. setTagRulesForDescription
	// already deletes and re-inserts, which is exactly the edit semantics — a rule
	// IS its set of tags.
	update: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const description = String(form.get('description') ?? '').trim();
		const tagNames = parseTagNames(form.get('tags'));
		if (!description) return fail(400, { error: 'Regra inválida.' });
		if (tagNames.length === 0) return fail(400, { error: 'Escolha ao menos uma tag.' });

		const db = getDb(platform!.env.DB);
		await setTagRulesForDescription(db, locals.userId, description, tagNames);
		await applyTagRules(db, locals.userId);
		setFlash(
			{
				type: ToastType.success,
				message: `Regra de "${description}" atualizada: ${tagNames.join(', ')}.`
			},
			event
		);
		return { success: true };
	},

	// Keyed by description, not by row id: the rule the user sees is the whole set
	// of tags for a description, so deleting it drops every row of that group.
	// Transactions already tagged keep their tags — what stops is new ones getting
	// them automatically.
	remove: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const description = String(form.get('description') ?? '').trim();
		if (!description) return fail(400, { error: 'Regra inválida.' });

		const db = getDb(platform!.env.DB);
		await deleteTagRulesForDescription(db, locals.userId, description);
		setFlash(
			{
				type: ToastType.success,
				message: `Regra de "${description}" excluída — as tags já aplicadas continuam.`
			},
			event
		);
		return { success: true };
	}
};
