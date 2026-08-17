import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { handleAuth } from '$lib/auth';
import { getAuth } from '$lib/server/auth';

// The session resolution lives in $lib/auth/hooks.ts, which the app now uses
// instead of keeping a private copy. It also reads platform inside the guarded
// path: this file used to dereference event.platform! before the try, so a
// request without a platform (a prerender pass, a misconfigured dev run) threw
// on every route including /login, rather than degrading to "not signed in".
const auth = handleAuth(getAuth);

// Security headers. The app renders bank balances and takes an API key in a
// form field, so an XSS here is worth real money to an attacker — these are the
// cheap mitigations that were simply absent.
//
// CSP is deliberately not set here: SvelteKit generates inline hydration
// scripts, so a useful policy needs the framework's own nonce/hash support
// (`kit.csp` in vite.config.ts) rather than a header written by hand, and a
// half-right policy that breaks hydration is worse than none. It stays the
// remaining gap in this set.
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Clickjacking: nothing in the app is meant to be framed.
	response.headers.set('X-Frame-Options', 'DENY');
	// Stops a browser re-interpreting a JSON response as HTML.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	// The referrer leaks the path, and a path here can name a transaction id.
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// The app asks for none of these; denying them removes the prompt entirely.
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
	);

	// HSTS only over HTTPS — on a plaintext dev origin it is ignored at best and
	// pins localhost to HTTPS at worst.
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

export const handle: Handle = sequence(auth, securityHeaders);
