import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

// If already logged in, go to dashboard. Otherwise, the page component
// handles the redirect to tabelaauth.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userId) redirect(303, '/dashboard');
};
