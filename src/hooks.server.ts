import type { Handle } from '@sveltejs/kit';
import { handleAuth } from '$lib/auth';
import { getAuth } from '$lib/server/auth';

// The session resolution lives in $lib/auth/hooks.ts, which the app now uses
// instead of keeping a private copy. It also reads platform inside the guarded
// path: this file used to dereference event.platform! before the try, so a
// request without a platform (a prerender pass, a misconfigured dev run) threw
// on every route including /login, rather than degrading to "not signed in".
export const handle: Handle = handleAuth(getAuth);
