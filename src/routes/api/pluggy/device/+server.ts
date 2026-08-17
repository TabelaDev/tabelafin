import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	hasDeviceToken,
	issueDeviceToken,
	revokeDeviceToken
} from '$lib/server/pluggy/device-token';

// Generates a long-lived pairing code for the browser extension
// (see docs/pluggy-integration.md). Called by the profile/onboarding page with
// the app session; the code is shown once and pasted into the extension popup.
// From then on the extension uses this token in the Authorization header when
// sending the Meu Pluggy token to /api/pluggy/token.
//
// Issuing rotates: the user's previous code stops working immediately. That is
// what makes "generate a new code" a usable response to a leaked one.
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const deviceToken = await issueDeviceToken(platform!.env.SESSIONS, locals.userId);
	return json({ deviceToken });
};

// Unpairs the extension. The code stops working right away, and the next Meu
// Pluggy token the extension tries to push is rejected.
export const DELETE: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const revoked = await revokeDeviceToken(platform!.env.SESSIONS, locals.userId);
	return json({ revoked });
};

// Whether a pairing exists — lets the profile screen say "extensão pareada"
// without ever re-displaying the code itself.
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const paired = await hasDeviceToken(platform!.env.SESSIONS, locals.userId);
	return json({ paired });
};
