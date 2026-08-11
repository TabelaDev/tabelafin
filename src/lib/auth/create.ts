// Módulo reutilizável de autenticação via Better Auth.
// Copie esta pasta inteira pra qualquer projeto SvelteKit + Drizzle + Cloudflare Workers.
//
// Uso:
//   1. Copie `src/lib/auth/` pro novo projeto
//   2. Instale `better-auth` e `@better-auth/drizzle-adapter`
//   3. Adicione as tabelas do schema no seu Drizzle schema (ver schema.ts)
//   4. Configure BETTER_AUTH_SECRET e BETTER_AUTH_URL nas env vars
//   5. Crie as rotas de login/signup usando os components

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { BetterAuthOptions } from 'better-auth';

export interface AuthConfig {
	db: ReturnType<typeof import('drizzle-orm/d1').drizzle>;
	provider: 'sqlite' | 'pg' | 'mysql';
	secret: string;
	baseURL?: string;
	cookiePrefix?: string;
	// Mapeamento dos modelos Better Auth ("user" | "session" | "account")
	// para os objetos de tabela do Drizzle, se os nomes diferirem do padrão.
	// As chaves são os nomes dos modelos; o nome real da tabela vem da própria
	// definição Drizzle.
	schema?: Partial<Record<'user' | 'session' | 'account', Record<string, unknown>>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

/**
 * Cria ou retorna a instância do Better Auth.
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
