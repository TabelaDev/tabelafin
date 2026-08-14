// Forwards Better Auth's Set-Cookie headers onto the SvelteKit response.
// Reusable — copy into any project.
//
// Usage in login/signup actions:
//   import { forwardCookies } from '$lib/auth/cookies';
//   const response = await auth.api.signInEmail({ body, asResponse: true });
//   forwardCookies(response, cookies);

import type { Cookies } from '@sveltejs/kit';

/**
 * Copies every Set-Cookie from `response` onto `cookies`, attributes included.
 *
 * The first version rebuilt each cookie from its name and value alone, forcing
 * path=/, httpOnly, secure and sameSite=lax. That dropped Max-Age and Expires,
 * so a session Better Auth meant to last a month became a browser-session
 * cookie; and it skipped any cookie with an empty value, which is exactly how
 * expiry is expressed — so sign-out never cleared anything through this path.
 */
export function forwardCookies(response: Response, cookies: Cookies): void {
	for (const header of splitSetCookie(response.headers)) {
		const parsed = parseSetCookie(header);
		if (!parsed) continue;
		cookies.set(parsed.name, parsed.value, parsed.options);
	}
}

/** One entry per Set-Cookie header, using getSetCookie when it is available. */
function splitSetCookie(headers: Headers): string[] {
	const withGetter = headers as Headers & { getSetCookie?: () => string[] };
	if (typeof withGetter.getSetCookie === 'function') {
		return withGetter.getSetCookie();
	}
	const raw = headers.get('set-cookie');
	if (!raw) return [];
	// Fallback split: a comma only starts a new cookie when what follows looks
	// like `name=value`, which keeps `Expires=Wed, 09 Jun 2027` in one piece.
	return raw.split(/,(?=\s*[^;=,]+=)/);
}

type CookieOptions = Parameters<Cookies['set']>[2];

type ParsedCookie = {
	name: string;
	value: string;
	options: CookieOptions;
};

function parseSetCookie(header: string): ParsedCookie | null {
	const [pair, ...attributes] = header.split(';');
	const eq = pair.indexOf('=');
	if (eq === -1) return null;

	const name = pair.slice(0, eq).trim();
	if (!name) return null;

	// An empty value is meaningful: paired with Max-Age=0 it is how a cookie is
	// deleted.
	const value = pair.slice(eq + 1).trim();

	// The header value is already percent-encoded. cookies.set() encodes again by
	// default, which double-encodes the session token and makes it fail to
	// validate — so the value is passed through verbatim.
	const options: CookieOptions = { path: '/', encode: (v: string) => v };
	for (const attribute of attributes) {
		const [rawKey, ...rest] = attribute.split('=');
		const key = rawKey.trim().toLowerCase();
		const attrValue = rest.join('=').trim();

		switch (key) {
			case 'path':
				options.path = attrValue || '/';
				break;
			case 'domain':
				options.domain = attrValue;
				break;
			case 'max-age':
				options.maxAge = Number(attrValue);
				break;
			case 'expires':
				options.expires = new Date(attrValue);
				break;
			case 'samesite':
				options.sameSite = attrValue.toLowerCase() as 'lax' | 'strict' | 'none';
				break;
			case 'httponly':
				options.httpOnly = true;
				break;
			case 'secure':
				options.secure = true;
				break;
		}
	}

	return { name, value, options };
}
