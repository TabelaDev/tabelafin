import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { emailVerificationRequired, getAuth } from '$lib/server/auth';
import { forwardCookies } from '$lib/auth';
import { friendlyAuthError } from '$lib/server/auth-errors';
import {
	checkRateLimit,
	clientRateLimitKey,
	rateLimitMessage,
	SIGN_UP_RULE
} from '$lib/server/rate-limit';

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

		// Keyed by address alone (not address + e-mail): the abuse here is one
		// actor minting many accounts under different addresses, so scoping by
		// e-mail would defeat the point.
		const limit = await checkRateLimit(
			platform!.env.SESSIONS,
			'signup',
			clientRateLimitKey(request),
			SIGN_UP_RULE
		);
		if (!limit.allowed) {
			console.warn('[auth/signup] rate limit atingido');
			return fail(429, { error: rateLimitMessage(limit.retryAfterSeconds) });
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
				error: e instanceof Error ? e.message : String(e)
			});
			return fail(400, { error: friendlyAuthError(e) });
		}

		// With e-mail verification on, sign-up creates the account but issues NO
		// session — the user is not logged in until they click the link. Sending
		// them to /dashboard here meant the layout guard bounced them straight to
		// /login with no explanation, seconds after signing up, while a
		// verification e-mail sat unmentioned in their inbox.
		//
		// `emailVerificationRequired` mirrors the condition in server/auth: mail is
		// wired, therefore verification is enforced.
		if (emailVerificationRequired(platform!.env)) {
			return { verificationSent: true, email };
		}

		redirect(303, '/dashboard');
	}
};
