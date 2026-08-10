// Módulo reutilizável de autenticação via Better Auth.
//
// Copie a pasta `src/lib/auth/` inteira pra qualquer projeto
// SvelteKit + Drizzle + Cloudflare Workers.
//
// Ver README.md pra instruções de uso.

export { createAuth } from './create';
export { friendlyAuthError } from './errors';
export { forwardCookies } from './cookies';
export { authUser, authSession, authAccount } from './schema';
export { handleAuth } from './hooks';
