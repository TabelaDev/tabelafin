import { unauthorizedJson } from '$lib/server/api-auth';
import { getDb } from '$lib/server/db';
import { exportUserData } from '$lib/server/db/user-data';

import type { RequestHandler } from './$types';

// LGPD art. 18, V/XV — portability and access. Returns the user's data as a
// JSON download.
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return unauthorizedJson();

	const db = getDb(platform!.env.DB);
	const data = await exportUserData(db, locals.userId);

	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="tabelhafin-${stamp}.json"`,
			// Never let an intermediary hold on to a copy of someone's finances.
			'cache-control': 'no-store'
		}
	});
};
