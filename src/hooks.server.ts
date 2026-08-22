import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { SessionService } from '$lib/server/services/session.service';
import { UserService } from '$lib/server/services/user.service';
import { TransactionService } from '$lib/server/services/transaction.service';
import { StatementService } from '$lib/server/services/statement.service';
import { AuthService } from '$lib/server/services/auth.service';

// Resolves the user session on every request.
//
// After the auth migration to tabelahub, tabelafin no longer runs Better Auth
// locally. Authentication is fully delegated to tabelahub:
//   1. User logs in on tabelahub
//   2. Tabelahub redirects to /api/auth/hub-callback?hub_token=<hmac token>
//   3. That route verifies the token, creates a KV session, sets the cookie
//   4. This hook validates the session cookie on every subsequent request
const auth: Handle = async ({ event, resolve }) => {
	event.locals.userId = null;
	event.locals.session = null;

	const env = event.platform?.env;
	if (!env) return resolve(event);

	// Instantiate services
	const sessionService = new SessionService(env.SESSIONS);
	const userService = new UserService(getDb(env.DB));
	const transactionService = new TransactionService(getDb(env.DB));
	const statementService = new StatementService(getDb(env.DB), env.MASTER_KEY);
	const authService = new AuthService(sessionService, userService);

	event.locals.sessionService = sessionService;
	event.locals.userService = userService;
	event.locals.transactionService = transactionService;
	event.locals.statementService = statementService;
	event.locals.authService = authService;

	const sessionToken = sessionService.getToken(event.cookies);
	if (sessionToken) {
		const user = await authService.validateSession(sessionToken);
		if (user) {
			event.locals.userId = user.id;
			event.locals.session = {
				user: {
					id: user.id,
					name: user.name,
					email: user.email
				},
				session: { id: sessionToken, token: sessionToken }
			};
		} else {
			await sessionService.delete(sessionToken);
			sessionService.clearCookie(event.cookies);
		}
	}

	return resolve(event);
};

// Security headers. The app renders bank balances and takes an API key in a
// form field, so an XSS here is worth real money to an attacker — these are the
// cheap mitigations that were simply absent.
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
	);

	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

export const handle: Handle = sequence(auth, securityHeaders);
