import { redirect } from 'sveltekit-flash-message/server';
import type { RequestHandler } from './$types';
import { ToastType } from '$lib/enums/toast-type';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const sessionToken = locals.authService.getSessionToken(cookies);

	if (sessionToken) {
		await locals.authService.logout(cookies, sessionToken);
	} else {
		locals.sessionService.clearCookie(cookies);
	}

	redirect('/login', { type: ToastType.success, message: 'Você saiu da sua conta.' }, cookies);
};
