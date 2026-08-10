import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

// Better Auth espera os modelos "user", "session", "account" no schema (chaves
// = nomes dos modelos, não das tabelas). O nome real da tabela vem do objeto
// Drizzle: "user", "session" e "accounts".
const authSchema = {
	user: schema.users,
	session: schema.sessions,
	account: schema.authAccounts
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAuth(env: Env): any {
	if (authInstance) return authInstance;

	const db = getDb(env.DB);

	authInstance = betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: authSchema
		}),
		emailAndPassword: {
			enabled: true
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
		advanced: {
			cookiePrefix: 'tabelafin'
		}
	});

	return authInstance;
}
