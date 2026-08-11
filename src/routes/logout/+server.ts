import { redirect } from 'sveltekit-flash-message/server';
import type { RequestHandler } from './$types';
import { forwardCookies } from '$lib/auth';
import { getAuth } from '$lib/server/auth';
import { ToastType } from '$lib/enums/toast-type';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const auth = getAuth(platform!.env);

	try {
		// Better Auth revokes the session server-side and answers with the
		// Set-Cookie headers that expire it. Those used to be thrown away and two
		// cookie names deleted by hand instead — which duplicated the cookiePrefix
		// configured elsewhere and missed any other cookie it sets.
		const response = await auth.api.signOut({
			headers: request.headers,
			asResponse: true
		});
		forwardCookies(response, cookies);
	} catch (err) {
		console.error('[auth/signout] falha ao encerrar sessão', {
			error: err instanceof Error ? err.message : String(err)
		});
	}

	redirect('/login', { type: ToastType.success, message: 'Você saiu da sua conta.' }, cookies);
};
