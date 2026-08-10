import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getUserAiPrompts, upsertUserAiPrompts } from '$lib/server/db/user-ai-prompts';
import { findUserById, updateUserAiToggles } from '$lib/server/db/users';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	// Usuário que ocultou IA não vê a configuração de prompts.
	const user = await findUserById(db, locals.userId);
	if (user?.hideAi) redirect(303, '/perfil');

	const prompts = await getUserAiPrompts(db, locals.userId);

	return {
		prompts,
		toggles: {
			categorization: user?.aiCategorizationEnabled ?? true,
			report: user?.aiReportEnabled ?? true,
			chat: user?.aiChatEnabled ?? true
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const categorizationPrompt = form.get('categorizationPrompt');
		const reportPrompt = form.get('reportPrompt');
		const chatSystemPrompt = form.get('chatSystemPrompt');

		if (
			typeof categorizationPrompt !== 'string' ||
			typeof reportPrompt !== 'string' ||
			typeof chatSystemPrompt !== 'string'
		) {
			return fail(400, { error: 'Dados inválidos.' });
		}

		const db = getDb(platform!.env.DB);

		await upsertUserAiPrompts(db, locals.userId, {
			categorizationPrompt: categorizationPrompt || null,
			reportPrompt: reportPrompt || null,
			chatSystemPrompt: chatSystemPrompt || null
		});

		// Toggles de funcionalidade (checkbox marcado = enabled).
		await updateUserAiToggles(db, locals.userId, {
			categorization: form.get('categorizationEnabled') === 'on',
			report: form.get('reportEnabled') === 'on',
			chat: form.get('chatEnabled') === 'on'
		});

		return { success: true };
	}
};
