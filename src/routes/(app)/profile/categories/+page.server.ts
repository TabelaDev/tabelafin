import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	addCategory,
	deleteCategory,
	getCategoriesByUser,
	updateCategory
} from '$lib/server/db/user-categories';
import { transactions } from '$lib/server/db/schema';

// The available colour palette — the same Catppuccin classes used in badges, with
// a Portuguese label for the dropdown.
const COLOR_OPTIONS: { value: string; label: string }[] = [
	{ value: 'ctp-peach', label: 'Pêssego' },
	{ value: 'ctp-sky', label: 'Céu' },
	{ value: 'ctp-mauve', label: 'Lilás' },
	{ value: 'ctp-red', label: 'Vermelho' },
	{ value: 'ctp-blue', label: 'Azul' },
	{ value: 'ctp-pink', label: 'Rosa' },
	{ value: 'ctp-yellow', label: 'Amarelo' },
	{ value: 'ctp-sapphire', label: 'Safira' },
	{ value: 'ctp-green', label: 'Verde' },
	{ value: 'ctp-lavender', label: 'Lavanda' },
	{ value: 'ctp-overlay1', label: 'Neutro' }
];

function isValidColor(color: string): boolean {
	return COLOR_OPTIONS.some((c) => c.value === color);
}

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');
	const db = getDb(platform!.env.DB);
	const categories = await getCategoriesByUser(db, locals.userId);
	return { categories, colorOptions: COLOR_OPTIONS };
};

export const actions: Actions = {
	add: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const color = String(form.get('color') ?? 'ctp-overlay1').trim();

		if (!name) return { error: 'Informe o nome da categoria.' };
		if (!isValidColor(color)) return { error: 'Cor inválida.' };

		const db = getDb(platform!.env.DB);
		const created = await addCategory(db, locals.userId, name, color);
		if (!created) return { error: `A categoria "${name}" já existe.` };
		return { success: true };
	},

	update: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const oldName = String(form.get('name') ?? '');
		const newName = String(form.get('newName') ?? '').trim();
		const color = String(form.get('color') ?? '').trim();

		if (!oldName) return { error: 'Categoria inválida.' };
		if (!newName) return { error: 'Informe o novo nome.' };
		if (!isValidColor(color)) return { error: 'Cor inválida.' };

		const db = getDb(platform!.env.DB);
		await updateCategory(db, locals.userId, oldName, { name: newName, color });

		// Renamed: repoints the transactions that carried the old name.
		if (newName !== oldName) {
			await db
				.update(transactions)
				.set({ category: newName })
				.where(eq(transactions.category, oldName));
		}
		return { success: true };
	},

	remove: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return { error: 'Categoria inválida.' };

		const db = getDb(platform!.env.DB);
		// Uncategorised transactions (null) are shown as "Outros" on the screens.
		await deleteCategory(db, locals.userId, name);
		return { success: true };
	}
};
