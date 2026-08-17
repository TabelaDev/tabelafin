import { createAuth } from '$lib/auth';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { sendPasswordResetEmail, sendVerificationEmail } from '$lib/server/email';

// Better Auth expects the models "user", "session" and "account" in the schema
// (the keys are model names, not table names). The real table name comes from
// the Drizzle object: "user", "session" and "accounts".
const authSchema = {
	user: schema.users,
	session: schema.sessions,
	account: schema.authAccounts
};

// This used to be a second, hand-written copy of what src/lib/auth/create.ts
// already does. Two implementations of the same wiring meant the one carrying
// the README saying "copy this folder into another project" was the one nobody
// exercised — so its bugs went unnoticed. The app consumes the module now, and
// this file is only the tabelafin-specific configuration.
/**
 * Whether sign-in is gated on a confirmed e-mail address.
 *
 * Single source of truth for the condition, because two places need the same
 * answer and they must not drift: getAuth (to set `requireEmailVerification`)
 * and the sign-up action (to know that no session was issued, so it must not
 * redirect into the app).
 */
export function emailVerificationRequired(env: unknown): boolean {
	const { BREVO_API_KEY, EMAIL_FROM } = env as Env;
	// Both, not just the key: Brevo refuses to deliver from an unverified or
	// missing sender, and gating sign-in on a mail that cannot be sent locks
	// every new account out permanently.
	return Boolean(BREVO_API_KEY && EMAIL_FROM);
}

export function getAuth(env: unknown) {
	const { DB, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BREVO_API_KEY, EMAIL_FROM } = env as Env;

	// Mail delivery is wired only when it can actually work. Without it the app
	// keeps behaving as it did before mail existed — no verification, no reset
	// link — instead of failing at sign-up because a secret was not set. That
	// matters for local dev and for the first deploy, where the credentials
	// legitimately are not there yet.
	const mail = emailVerificationRequired(env)
		? {
				sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
					await sendVerificationEmail(BREVO_API_KEY, EMAIL_FROM, user.email, url);
				},
				sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
					await sendPasswordResetEmail(BREVO_API_KEY, EMAIL_FROM, user.email, url);
				},
				// Only gate sign-in behind verification when a mail can actually be
				// sent — otherwise every new account would be permanently locked out.
				requireEmailVerification: true
			}
		: {};

	return createAuth({
		db: getDb(DB),
		provider: 'sqlite',
		secret: BETTER_AUTH_SECRET,
		baseURL: BETTER_AUTH_URL,
		cookiePrefix: 'tabelafin',
		schema: authSchema as unknown as Parameters<typeof createAuth>[0]['schema'],
		...mail
	});
}
