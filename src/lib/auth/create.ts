// Reusable Better Auth authentication module.
// Copy this whole folder into any SvelteKit + Drizzle + Cloudflare Workers project.
//
// Usage:
//   1. Copy `src/lib/auth/` into the new project
//   2. Install `better-auth` and `@better-auth/drizzle-adapter`
//   3. Add the schema's tables to your Drizzle schema (see schema.ts)
//   4. Set BETTER_AUTH_SECRET and BETTER_AUTH_URL in the env vars
//   5. Create the login/signup routes using the components

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { BetterAuthOptions } from 'better-auth';

export interface AuthConfig {
	db: ReturnType<typeof import('drizzle-orm/d1').drizzle>;
	provider: 'sqlite' | 'pg' | 'mysql';
	secret: string;
	baseURL?: string;
	cookiePrefix?: string;
	// Maps the Better Auth models ("user" | "session" | "account") onto the
	// Drizzle table objects, for when the names differ from the defaults. The keys
	// are the model names; the real table name comes from the Drizzle definition
	// itself.
	schema?: Partial<Record<'user' | 'session' | 'account', Record<string, unknown>>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

/**
 * Creates or returns the Better Auth instance.
 * Singleton — multiple calls return the same instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAuth(config: AuthConfig): any {
	if (authInstance) return authInstance;

	const options: BetterAuthOptions = {
		database: drizzleAdapter(config.db, {
			provider: config.provider,
			...(config.schema && { schema: config.schema })
		}),
		emailAndPassword: {
			enabled: true
		},
		secret: config.secret,
		baseURL: config.baseURL || 'http://localhost:5173',
		advanced: {
			cookiePrefix: config.cookiePrefix || 'app'
		}
	};

	authInstance = betterAuth(options);
	return authInstance;
}
