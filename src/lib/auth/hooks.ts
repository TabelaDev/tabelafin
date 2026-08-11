// SvelteKit hook that resolves the Better Auth session on every request.
// Copy into your hooks.server.ts.
//
// Usage:
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
 * Creates a SvelteKit handler that resolves the Better Auth session on every
 * request. The userId is then available on event.locals.userId for every route.
 */
export function handleAuth(getAuth: (env: unknown) => AuthInstance): Handle {
	return async ({ event, resolve }) => {
		event.locals.userId = null;
		event.locals.session = null;

		try {
			// Reading platform belongs inside the guard: it was dereferenced with
			// a non-null assertion before the try, so a request that arrives
			// without one — a prerender pass, a dev run outside wrangler — threw
			// on every route, including the login page that would have let the
			// user recover.
			const env = event.platform?.env;
			if (env) {
				const session = await getAuth(env).api.getSession({
					headers: event.request.headers
				});
				event.locals.userId = session?.user?.id ?? null;
				event.locals.session = session;
			}
		} catch (err) {
			console.error('[auth/session] falha ao checar sessão', {
				error: err instanceof Error ? err.message : String(err)
			});
		}

		return resolve(event);
	};
}
