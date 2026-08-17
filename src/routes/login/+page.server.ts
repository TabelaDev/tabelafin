import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { forwardCookies } from '$lib/auth';
import { friendlyAuthError } from '$lib/server/auth-errors';
import {
	checkRateLimit,
	clientRateLimitKey,
	rateLimitMessage,
	SIGN_IN_RULE
} from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userId) redirect(303, '/dashboard');
};

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const form = await request.formData();
		const email = form.get('email');
		const password = form.get('password');

		if (typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, { error: 'Informe e-mail e senha.' });
		}

		// Checked before the credentials are, and keyed by address + e-mail so a
		// shared NAT does not lock everyone out over one person's typo. This form
		// action calls Better Auth's API directly, which skips its own router
		// middleware — without this, password guessing here is unbounded.
		const limit = await checkRateLimit(
			platform!.env.SESSIONS,
			'signin',
			clientRateLimitKey(request, email),
			SIGN_IN_RULE
		);
		if (!limit.allowed) {
			// No e-mail in the log line: these end up in Cloudflare's log stream, and
			// a failed-login log keyed by address is enough to debug with.
			console.warn('[auth/signin] rate limit atingido');
			return fail(429, { error: rateLimitMessage(limit.retryAfterSeconds) });
		}

		const auth = getAuth(platform!.env);

		try {
			const response = await auth.api.signInEmail({
				body: { email, password },
				asResponse: true
			});

			if (!response.ok) {
				const body = (await response.json()) as { message?: string };
				const rawMessage = body?.message ?? 'Credenciais inválidas';
				console.error('[auth/signin] falha no login', {
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
			console.error('[auth/signin] erro no login', {
				error: e instanceof Error ? e.message : String(e)
			});
			return fail(400, { error: friendlyAuthError(e) });
		}

		redirect(303, '/dashboard');
	}
};
