import { fail, redirect } from '@sveltejs/kit';
import { redirect as flashRedirect } from 'sveltekit-flash-message/server';
import { setFlash } from 'sveltekit-flash-message/server';
import type { Actions, PageServerLoad } from './$types';
import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { deleteUserAccount } from '$lib/server/db/user-data';
import { revokeDeviceToken } from '$lib/server/pluggy/device-token';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [ai, pluggy, user] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId),
		locals.userService.findById(locals.userId)
	]);

	return {
		user: locals.session?.user ?? null,
		hideAi: user?.hideAi ?? false,
		aiConfigured: Boolean(ai),
		aiProvider: ai?.provider ?? null,
		aiModel: ai?.model ?? null,
		pluggyConfigured: Boolean(pluggy)
	};
};

export const actions: Actions = {
	hideAi: async (event) => {
		const { request, locals } = event;
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const hidden = form.get('hideAi') === 'on';

		await locals.userService.setHideAi(locals.userId, hidden);

		setFlash(
			{
				type: ToastType.success,
				message: hidden ? 'Recursos de IA ocultados.' : 'Recursos de IA reativados.'
			},
			event
		);
		return { hideAi: hidden };
	},

	updateName: async (event) => {
		const { request, locals } = event;
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Informe o nome completo.' });

		await locals.userService.updateName(locals.userId, name);

		const sessionToken = locals.authService.getSessionToken(event.cookies);
		if (sessionToken) {
			await locals.authService.updateSessionName(event.cookies, sessionToken, name);
		}

		setFlash({ type: ToastType.success, message: 'Nome atualizado.' }, event);
		return { success: true };
	},

	deleteAccount: async (event) => {
		const { request, locals, platform, cookies } = event;
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const confirmation = String(form.get('confirmEmail') ?? '')
			.trim()
			.toLowerCase();

		const user = await locals.userService.findById(locals.userId);
		if (!user) redirect(303, '/login');

		if (confirmation !== user.email.toLowerCase()) {
			return fail(400, { error: 'O e-mail digitado não confere com o da sua conta.' });
		}

		await revokeDeviceToken(platform!.env.SESSIONS, locals.userId);
		await locals.userService.deleteAccount(locals.userId);

		for (const name of cookies.getAll().map((c) => c.name)) {
			if (name.startsWith('tabelafin')) cookies.delete(name, { path: '/' });
		}

		flashRedirect(
			'/',
			{ type: ToastType.success, message: 'Conta excluída com sucesso.' },
			cookies
		);
	}
};
