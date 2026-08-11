import { createAuth } from '$lib/auth';
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

// This used to be a second, hand-written copy of what src/lib/auth/create.ts
// already does. Two implementations of the same wiring meant the one carrying
// the README saying "copy this folder into another project" was the one nobody
// exercised — so its bugs went unnoticed. The app consumes the module now, and
// this file is only the tabelafin-specific configuration.
export function getAuth(env: unknown) {
	const { DB, BETTER_AUTH_SECRET, BETTER_AUTH_URL } = env as Env;
	return createAuth({
		db: getDb(DB),
		provider: 'sqlite',
		secret: BETTER_AUTH_SECRET,
		baseURL: BETTER_AUTH_URL,
		cookiePrefix: 'tabelafin',
		schema: authSchema as unknown as Parameters<typeof createAuth>[0]['schema']
	});
}
