import { redirect } from 'sveltekit-flash-message/server';
import type { RequestHandler } from './$types';
import { getAuth } from '$lib/server/auth';
import { ToastType } from '$lib/enums/toast-type';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const auth = getAuth(platform!.env);

	try {
		await auth.api.signOut({
			headers: request.headers,
			asResponse: true
		});
	} catch {
		// Ignore signOut errors — clear local cookies anyway
	}

	// Clear Better Auth cookies
	for (const name of ['tabelafin.session_token', 'better-auth.session_token']) {
		cookies.delete(name, { path: '/' });
	}

	redirect('/login', { type: ToastType.success, message: 'Você saiu da sua conta.' }, cookies);
};
