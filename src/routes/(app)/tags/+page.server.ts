import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getTagsByUser, getTagTotals } from '$lib/server/db/tags';

// Overview only — the CRUD lives in /tags/manage and the automatic rules in
// /tags/rules, mirroring how /categories is split. This page used to hold all
// three, which is why its rules section had none of what the categories rules
// page has (table, search, pagination, editing).
export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');
	const db = getDb(platform!.env.DB);

	// Every tag the user owns, merged with the totals — a freshly created tag
	// has no transactions yet, so getTagTotals alone (which joins the junction)
	// would silently hide it from the list.
	const [userTags, totals] = await Promise.all([
		getTagsByUser(db, locals.userId),
		getTagTotals(db, locals.userId)
	]);
	const totalsByTagId = new Map(totals.map((t) => [t.tagId, t]));
	const tags = userTags.map((t) => {
		const total = totalsByTagId.get(t.id);
		return {
			tagId: t.id,
			name: t.name,
			count: total?.count ?? 0,
			expense: total?.expense ?? 0,
			income: total?.income ?? 0
		};
	});

	return { tags };
};
