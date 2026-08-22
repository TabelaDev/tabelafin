import { fail, redirect } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import type { Actions, PageServerLoad } from './$types';
import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import {
	addCategory,
	deleteCategory,
	getCategoriesByUser,
	updateCategory
} from '$lib/server/db/user-categories';
import {
	clearCategoryOnTransactions,
	renameCategoryOnTransactions
} from '$lib/server/db/transactions';
import { renameCategoryOnRules } from '$lib/server/db/categorization-rules';

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
	add: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const color = String(form.get('color') ?? 'ctp-overlay1').trim();

		if (!name) return fail(400, { error: 'Informe o nome da categoria.' });
		if (!isValidColor(color)) return fail(400, { error: 'Cor inválida.' });

		const db = getDb(platform!.env.DB);
		const created = await addCategory(db, locals.userId, name, color);
		if (!created) return fail(400, { error: `A categoria "${name}" já existe.` });
		setFlash({ type: ToastType.success, message: `Categoria "${name}" criada.` }, event);
		return { success: true };
	},

	update: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const oldName = String(form.get('name') ?? '');
		const newName = String(form.get('newName') ?? '').trim();
		const color = String(form.get('color') ?? '').trim();

		if (!oldName) return fail(400, { error: 'Categoria inválida.' });
		if (!newName) return fail(400, { error: 'Informe o novo nome.' });
		if (!isValidColor(color)) return fail(400, { error: 'Cor inválida.' });

		const db = getDb(platform!.env.DB);
		await updateCategory(db, locals.userId, oldName, { name: newName, color });

		// Renamed: repoints the transactions that carried the old name.
		if (newName !== oldName) {
			await renameCategoryOnTransactions(db, locals.userId, oldName, newName);
		}
		setFlash(
			{
				type: ToastType.success,
				message:
					newName === oldName
						? `Categoria "${newName}" atualizada.`
						: `"${oldName}" agora é "${newName}".`
			},
			event
		);
		return { success: true };
	},

	remove: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) redirect(303, '/login');
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Categoria inválida.' });

		const migrateTo = String(form.get('migrateTo') ?? '').trim();

		const db = getDb(platform!.env.DB);

		if (migrateTo) {
			// The target must be one of the user's own categories, and not the one
			// being deleted.
			const categories = await getCategoriesByUser(db, locals.userId);
			const valid = categories.some((c) => c.name === migrateTo && c.name !== name);
			if (!valid) return fail(400, { error: 'Categoria de destino inválida.' });
		}

		await deleteCategory(db, locals.userId, name);
		if (migrateTo) {
			// Migrate: repoint the transactions AND the automatic rules from the
			// deleted category to the target, so nothing falls to "Outros".
			await renameCategoryOnTransactions(db, locals.userId, name, migrateTo);
			await renameCategoryOnRules(db, locals.userId, name, migrateTo);
		} else {
			// No target chosen — the category is gone, so its transactions lose the
			// bucket (back to "Outros"), never deleted.
			await clearCategoryOnTransactions(db, locals.userId, name);
		}
		// Says where the transactions went: this action is destructive and used to
		// finish in complete silence.
		setFlash(
			{
				type: ToastType.success,
				message: migrateTo
					? `Categoria "${name}" excluída — transações movidas para "${migrateTo}".`
					: `Categoria "${name}" excluída — transações agora são "Outros".`
			},
			event
		);
		return { success: true };
	}
};
