import { redirect } from '@sveltejs/kit';

/** Guard for `load`/actions on authenticated routes: no session, no page. */
export function requireLogin(): never {
	redirect(303, '/login');
}
