import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { exportUserData } from '$lib/server/db/user-data';

// LGPD art. 18, V/XV — portability and access. Returns the user's data as a
// JSON download.
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const db = getDb(platform!.env.DB);
	const data = await exportUserData(db, locals.userId);

	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="tabelafin-${stamp}.json"`,
			// Never let an intermediary hold on to a copy of someone's finances.
			'cache-control': 'no-store'
		}
	});
};
