import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getPluggyCredentials } from '$lib/server/db/pluggy-credentials';
import { findUserById, setUserHideAi, setUserName } from '$lib/server/db/users';
import { deleteUserAccount } from '$lib/server/db/user-data';
import { revokeDeviceToken } from '$lib/server/pluggy/device-token';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const [ai, pluggy, user] = await Promise.all([
		getAiCredentials(db, locals.userId),
		getPluggyCredentials(db, locals.userId),
		findUserById(db, locals.userId)
	]);

	return {
		user: locals.session?.user ?? null,
		hideAi: user?.hideAi ?? false,
		aiConfigured: Boolean(ai),
		aiProvider: ai?.provider ?? null,
		aiModel: ai?.model ?? null,
		pluggyConfigured: Boolean(pluggy)
	};
};

export const actions: Actions = {
	hideAi: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const hidden = form.get('hideAi') === 'on';

		const db = getDb(platform!.env.DB);
		await setUserHideAi(db, locals.userId, hidden);

		return { hideAi: hidden };
	},

	// The full legal name is used to spot Pix/TED between the user's own accounts
	// (see server/pluggy/internal-transfers.ts) — an existing short name like
	// "Ian" must be corrected to the full name for that detection to work.
	updateName: async ({ request, locals, platform }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Informe o nome completo.' });

		const db = getDb(platform!.env.DB);
		await setUserName(db, locals.userId, name);
		return { success: true };
	},

	// LGPD art. 18, VI — elimination. Irreversible, so it is gated on the user
	// typing their own e-mail: a stray click on a button cannot do this.
	deleteAccount: async ({ request, locals, platform, cookies }) => {
		if (!locals.userId) redirect(303, '/login');

		const form = await request.formData();
		const confirmation = String(form.get('confirmEmail') ?? '')
			.trim()
			.toLowerCase();

		const db = getDb(platform!.env.DB);
		const user = await findUserById(db, locals.userId);
		if (!user) redirect(303, '/login');

		if (confirmation !== user.email.toLowerCase()) {
			return fail(400, { deleteError: 'O e-mail digitado não confere com o da sua conta.' });
		}

		// The device token lives in KV, outside the database, so no foreign key
		// reaches it — revoke it before the row that identifies its owner is gone.
		await revokeDeviceToken(platform!.env.SESSIONS, locals.userId);
		await deleteUserAccount(db, locals.userId);

		// Sessions cascade with the user row, but the browser still holds the
		// cookie; clearing it avoids a confusing "logged in as a deleted user"
		// state on the next request.
		for (const name of cookies.getAll().map((c) => c.name)) {
			if (name.startsWith('tabelafin')) cookies.delete(name, { path: '/' });
		}

		redirect(303, '/?conta-excluida=1');
	}
};
