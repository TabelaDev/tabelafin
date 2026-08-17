import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { friendlyAuthError } from '$lib/server/auth-errors';

export const load: PageServerLoad = async ({ url }) => {
	// Better Auth appends the one-time token as a query parameter on the link it
	// mails. Landing here without one means the link was truncated or already
	// consumed — say so rather than showing a form that cannot work.
	const token = url.searchParams.get('token');
	return { hasToken: Boolean(token), token };
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const form = await request.formData();
		const token = form.get('token');
		const password = form.get('password');
		const confirm = form.get('confirm');

		if (typeof token !== 'string' || !token) {
			return fail(400, { error: 'Link inválido ou expirado. Peça um novo.' });
		}
		if (typeof password !== 'string' || typeof confirm !== 'string') {
			return fail(400, { error: 'Preencha os dois campos.' });
		}
		if (password.length < 8) {
			return fail(400, { error: 'A senha deve ter pelo menos 8 caracteres.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'As senhas não conferem.' });
		}

		// Not rate limited: the token is the secret, it is single-use, and it
		// already carries its own expiry — a limit here would only stop the user
		// from correcting a typo.
		const auth = getAuth(platform!.env);

		try {
			await auth.api.resetPassword({ body: { token, newPassword: password } });
		} catch (e) {
			console.error('[auth/reset-password] falha ao redefinir', {
				error: e instanceof Error ? e.message : String(e)
			});
			return fail(400, { error: friendlyAuthError(e) });
		}

		// To /login rather than straight into the app: signing in with the new
		// password is the confirmation that it took.
		redirect(303, '/login?reset=1');
	}
};
