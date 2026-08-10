import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
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

			// Forward session cookies from Better Auth to the browser
			const setCookie = response.headers.get('set-cookie');
			if (setCookie) {
				const parts = setCookie.split(/,(?=[^;]+=[^;])/);
				for (const part of parts) {
					const cookie = part.trim();
					if (!cookie) continue;
					const [nameValue] = cookie.split(';');
					const eqIdx = nameValue.indexOf('=');
					if (eqIdx === -1) continue;
					const cookieName = nameValue.substring(0, eqIdx).trim();
					let cookieValue = nameValue.substring(eqIdx + 1).trim();
					// O header set-cookie já vem URL-encoded; cookies.set() re-codifica,
					// senão o valor fica duplamente codificado e a sessão não valida.
					try {
						cookieValue = decodeURIComponent(cookieValue);
					} catch {
						// mantém o valor bruto se não for encoding válido
					}
					if (cookieName && cookieValue) {
						cookies.set(cookieName, cookieValue, {
							path: '/',
							httpOnly: true,
							secure: !dev,
							sameSite: 'lax'
						});
					}
				}
			}
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
