import { redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import { getCategoriesByUser } from '$lib/server/db/user-categories';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) redirect(303, '/login');

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	// The user's own categories — the per-category total is computed below.
	const userCategories = await getCategoriesByUser(db, userId);

	// All-time spending per category (the negative amounts).
	const rows = await db
		.select({ category: transactions.category, amount: transactions.amount })
		.from(transactions)
		.where(and(eq(transactions.userId, userId), isNull(transactions.supersededByTransactionId)));

	const totals: Record<string, number> = {};
	for (const r of rows) {
		if (r.amount >= 0) continue;
		const cat = r.category ?? 'Outros';
		totals[cat] = (totals[cat] ?? 0) + Math.abs(r.amount);
	}

	// Lists the user's categories with their totals; "Outros" (uncategorised
	// spending) goes last when it has a value.
	const categories = userCategories
		.map((c) => ({
			name: c.name,
			color: c.color,
			total: Math.round((totals[c.name] ?? 0) * 100) / 100
		}))
		.sort((a, b) => b.total - a.total);

	if (!userCategories.some((c) => c.name === 'Outros')) {
		categories.push({
			name: 'Outros',
			color: 'ctp-overlay1',
			total: Math.round((totals['Outros'] ?? 0) * 100) / 100
		});
	}

	return { categories };
};
