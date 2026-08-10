import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Visitante deslogado vê a landing (+page.svelte); só quem já tem sessão pula
// direto pro dashboard.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userId) redirect(303, '/dashboard');
};
