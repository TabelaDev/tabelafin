import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	DEVICE_TOKEN_KV_PREFIX,
	DEVICE_TOKEN_TTL_SECONDS,
	generateDeviceToken
} from '$lib/server/pluggy/device-token';

// Generates a long-lived pairing code for the browser extension
// (see docs/pluggy-integration.md). Called by the profile/onboarding page with
// the app session; the code is shown once and pasted into the extension popup.
// From then on the extension uses this token in the Authorization header when
// sending the Meu Pluggy token to /api/pluggy/token.
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const deviceToken = generateDeviceToken();
	await platform!.env.SESSIONS.put(`${DEVICE_TOKEN_KV_PREFIX}${deviceToken}`, locals.userId, {
		expirationTtl: DEVICE_TOKEN_TTL_SECONDS
	});

	return json({ deviceToken });
};
