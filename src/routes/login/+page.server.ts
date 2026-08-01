import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { timingSafeEqualStrings } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { findUserByEmail, createUser } from '$lib/server/db/users';
import { createSession } from '$lib/server/session';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userId) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const form = await request.formData();
		const token = form.get('token');

		if (typeof token !== 'string' || token.length === 0) {
			return fail(400, { error: 'Informe o token de acesso.' });
		}

		const valid = await timingSafeEqualStrings(token, platform!.env.LOGIN_TOKEN);
		if (!valid) return fail(400, { error: 'Token inválido.' });

		const db = getDb(platform!.env.DB);
		const ownerEmail = platform!.env.OWNER_EMAIL;
		let user = await findUserByEmail(db, ownerEmail);
		if (!user) {
			user = await createUser(db, ownerEmail, 'UTC');
		}

		await createSession(platform!.env.SESSIONS, cookies, user.id);
		redirect(303, '/');
	}
};
