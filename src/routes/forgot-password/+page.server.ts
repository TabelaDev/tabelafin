import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import {
	checkRateLimit,
	clientRateLimitKey,
	rateLimitMessage,
	SIGN_IN_RULE
} from '$lib/server/rate-limit';

export const load: PageServerLoad = async () => {
	// Deliberately reachable while signed in: a session on a shared machine is
	// exactly when someone wants to rotate their password.
	return {};
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const form = await request.formData();
		const email = form.get('email');

		if (typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { error: 'Informe um e-mail válido.' });
		}

		// Same budget as sign-in: this endpoint sends mail to an address the caller
		// chose, so without a limit it is both a spam relay and a way to probe
		// which addresses exist by timing.
		const limit = await checkRateLimit(
			platform!.env.SESSIONS,
			'forgot-password',
			clientRateLimitKey(request),
			SIGN_IN_RULE
		);
		if (!limit.allowed) {
			return fail(429, { error: rateLimitMessage(limit.retryAfterSeconds) });
		}

		const auth = getAuth(platform!.env);

		try {
			await auth.api.forgetPassword({
				body: { email, redirectTo: '/reset-password' }
			});
		} catch (e) {
			// Swallowed on purpose. Reporting the failure would leak whether the
			// address has an account — the response below is identical either way.
			console.error('[auth/forgot-password] falha ao solicitar redefinição', {
				error: e instanceof Error ? e.message : String(e)
			});
		}

		// Always the same answer, regardless of whether the account exists.
		return { sent: true };
	}
};
