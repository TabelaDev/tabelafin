// Extension pairing device token (see docs/pluggy-integration.md).
//
// The extension authenticates on API endpoints with this long-lived token
// instead of the session cookie: the cookie is HttpOnly + SameSite=Lax, so it
// does not travel in a cross-origin fetch from the extension's service worker.
// Pairing happens once on the profile/onboarding page, and the token is stored
// in the `SESSIONS` KV (key `pluggy_device:<token>`) mapping to the userId —
// the `/api/pluggy/token` endpoint resolves the session from it.
//
// The token grants the ability to overwrite the user's stored Meu Pluggy
// credential, so two properties matter beyond generating it:
//
//   - **One active token per user.** KV cannot be queried by value, so without
//     a back-reference there was no way to find a user's tokens and every call
//     to the pairing endpoint minted *another* valid one that nothing could
//     ever invalidate. `pluggy_device_current:<userId>` is that back-reference:
//     issuing rotates, so the previous token dies the moment a new one is made.
//   - **A bounded lifetime.** A year was long enough that a token pasted into a
//     machine the user no longer owns outlived their memory of it.

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
// Reverse index: userId → the one token currently valid for them.
export const DEVICE_TOKEN_CURRENT_PREFIX = 'pluggy_device_current:';

// 90 days. Long enough that a working extension is not re-paired every month,
// short enough that an abandoned pairing lapses on its own.
export const DEVICE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;

/**
 * Issues a token for the user, invalidating whatever they had before.
 * Returns the new token.
 */
export async function issueDeviceToken(kv: KVNamespace, userId: string): Promise<string> {
	await revokeDeviceToken(kv, userId);

	const deviceToken = generateDeviceToken();
	await kv.put(`${DEVICE_TOKEN_KV_PREFIX}${deviceToken}`, userId, {
		expirationTtl: DEVICE_TOKEN_TTL_SECONDS
	});
	await kv.put(`${DEVICE_TOKEN_CURRENT_PREFIX}${userId}`, deviceToken, {
		expirationTtl: DEVICE_TOKEN_TTL_SECONDS
	});
	return deviceToken;
}

/**
 * Invalidates the user's current token, if any. Safe to call when none exists.
 * Returns whether something was actually revoked, so the UI can tell "unpaired"
 * from "there was nothing paired".
 */
export async function revokeDeviceToken(kv: KVNamespace, userId: string): Promise<boolean> {
	const currentKey = `${DEVICE_TOKEN_CURRENT_PREFIX}${userId}`;
	const existing = await kv.get(currentKey);
	if (!existing) return false;

	await kv.delete(`${DEVICE_TOKEN_KV_PREFIX}${existing}`);
	await kv.delete(currentKey);
	return true;
}

/** Whether the user currently has a paired extension. */
export async function hasDeviceToken(kv: KVNamespace, userId: string): Promise<boolean> {
	return Boolean(await kv.get(`${DEVICE_TOKEN_CURRENT_PREFIX}${userId}`));
}
