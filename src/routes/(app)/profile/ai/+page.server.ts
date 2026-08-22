import { fail, redirect } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import type { Actions, PageServerLoad } from './$types';
import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import { getUserAiPrompts, upsertUserAiPrompts } from '$lib/server/db/user-ai-prompts';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const user = await locals.userService.findById(locals.userId);
	if (user?.hideAi) redirect(303, '/profile');

	const db = getDb(platform!.env.DB);
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
	default: async (event) => {
		const { request, locals, platform } = event;
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

		await locals.userService.updateAiToggles(locals.userId, {
			categorization: form.get('categorizationEnabled') === 'on',
			report: form.get('reportEnabled') === 'on',
			chat: form.get('chatEnabled') === 'on'
		});

		setFlash({ type: ToastType.success, message: 'Configuração de IA salva.' }, event);
		return { success: true };
	}
};
