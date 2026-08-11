import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { forwardCookies } from '$lib/auth';
import { friendlyAuthError } from '$lib/server/auth-errors';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userId) redirect(303, '/dashboard');
};

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const form = await request.formData();
		const name = form.get('name');
		const email = form.get('email');
		const password = form.get('password');

		if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, { error: 'Preencha todos os campos.' });
		}

		if (password.length < 8) {
			return fail(400, { error: 'A senha deve ter pelo menos 8 caracteres.' });
		}

		const auth = getAuth(platform!.env);

		try {
			const response = await auth.api.signUpEmail({
				body: { name, email, password },
				asResponse: true
			});

			if (!response.ok) {
				const body = (await response.json()) as { message?: string };
				const rawMessage = body?.message ?? 'Erro ao criar conta';
				console.error('[auth/signup] falha ao criar conta', {
					status: response.status,
					email,
					message: rawMessage
				});
				return fail(400, {
					error: friendlyAuthError(new Error(rawMessage))
				});
			}

			// Attributes come straight from Better Auth (Max-Age, Expires, SameSite),
			// so the session lasts exactly as long as it was issued for.
			forwardCookies(response, cookies);
		} catch (e) {
			console.error('[auth/signup] erro ao criar conta', {
				email,
				error: e instanceof Error ? e.message : String(e)
			});
			return fail(400, { error: friendlyAuthError(e) });
		}

		redirect(303, '/dashboard');
	}
};
