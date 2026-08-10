// Hook do SvelteKit pra resolver sessão do Better Auth em cada request.
// Copie pro seu hooks.server.ts.
//
// Uso:
//   import { handleAuth } from '$lib/auth/hooks';
//   export const handle = handleAuth(getAuth);

import type { Handle } from '@sveltejs/kit';

type AuthInstance = {
	api: {
		getSession: (opts: { headers: Headers }) => Promise<{
			user: { id: string; name: string; email: string; image?: string | null };
			session: { id: string; token: string };
		} | null>;
	};
};

/**
 * Cria um handler do SvelteKit que resolve a sessão do Better Auth em cada request.
 * O userId fica disponível em event.locals.userId pra todas as rotas.
 */
export function handleAuth(getAuth: (env: unknown) => AuthInstance): Handle {
	return async ({ event, resolve }) => {
		const auth = getAuth(event.platform!.env);

		try {
			const session = await auth.api.getSession({
				headers: event.request.headers
			});

			event.locals.userId = session?.user?.id ?? null;
			event.locals.session = session;
		} catch {
			event.locals.userId = null;
			event.locals.session = null;
		}

		return resolve(event);
	};
}
