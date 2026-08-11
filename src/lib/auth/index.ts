// Reusable Better Auth authentication module.
//
// Copy the whole `src/lib/auth/` folder into any
// SvelteKit + Drizzle + Cloudflare Workers project.
//
// See README.md for usage instructions.

export { createAuth } from './create';
export { friendlyAuthError } from './errors';
export { forwardCookies } from './cookies';
export { authUser, authSession, authAccount } from './schema';
export { handleAuth } from './hooks';
