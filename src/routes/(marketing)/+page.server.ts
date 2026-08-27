import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

// A signed-out visitor gets the landing page (+page.svelte); only someone who
// already has a session skips straight to the dashboard.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userId) redirect(303, '/dashboard');
};
