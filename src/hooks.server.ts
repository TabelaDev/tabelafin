import type { Handle } from '@sveltejs/kit';
import { getAuth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const auth = getAuth(event.platform!.env);

	try {
		const session = await auth.api.getSession({
			headers: event.request.headers
		});

		event.locals.userId = session?.user?.id ?? null;
		event.locals.session = session;
	} catch (err) {
		console.error('[auth/session] falha ao checar sessão', {
			error: err instanceof Error ? err.message : String(err)
		});
		event.locals.userId = null;
		event.locals.session = null;
	}

	return resolve(event);
};
