// Extension pairing device token (see docs/pluggy-integration.md).
//
// The extension authenticates on API endpoints with this long-lived token
// instead of the session cookie: the cookie is HttpOnly + SameSite=Lax, so it
// does not travel in a cross-origin fetch from the extension's service worker.
// Pairing happens once on the profile/onboarding page, and the token is stored
// in the `SESSIONS` KV (key `pluggy_device:<token>`) mapping to the userId —
// the `/api/pluggy/token` endpoint resolves the session from it.

/** Generates a random device token (256 bits) in base64url. */
export function generateDeviceToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export const DEVICE_TOKEN_KV_PREFIX = 'pluggy_device:';
export const DEVICE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365;
