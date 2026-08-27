import { getDb } from '$lib/server/db';
import {
	categorizationRules,
	chatConversations,
	financeAccounts,
	monthlyReports,
	recurringExpenses,
	statementUploads,
	tagRules,
	tags,
	transactions,
	userAiPrompts,
	userCategories
} from '$lib/server/db/schema';

import { count, eq } from 'drizzle-orm';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) {
		return { counts: null };
	}

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	const [
		transactionsCount,
		accountsCount,
		categoriesCount,
		rulesCount,
		tagsCount,
		tagRulesCount,
		recurringCount,
		reportsCount,
		uploadsCount,
		conversationsCount,
		promptsCount
	] = await Promise.all([
		db.select({ value: count() }).from(transactions).where(eq(transactions.userId, userId)),
		db.select({ value: count() }).from(financeAccounts).where(eq(financeAccounts.userId, userId)),
		db.select({ value: count() }).from(userCategories).where(eq(userCategories.userId, userId)),
		db
			.select({ value: count() })
			.from(categorizationRules)
			.where(eq(categorizationRules.userId, userId)),
		db.select({ value: count() }).from(tags).where(eq(tags.userId, userId)),
		db.select({ value: count() }).from(tagRules).where(eq(tagRules.userId, userId)),
		db
			.select({ value: count() })
			.from(recurringExpenses)
			.where(eq(recurringExpenses.userId, userId)),
		db.select({ value: count() }).from(monthlyReports).where(eq(monthlyReports.userId, userId)),
		db.select({ value: count() }).from(statementUploads).where(eq(statementUploads.userId, userId)),
		db
			.select({ value: count() })
			.from(chatConversations)
			.where(eq(chatConversations.userId, userId)),
		db.select({ value: count() }).from(userAiPrompts).where(eq(userAiPrompts.userId, userId))
	]);

	return {
		counts: {
			transactions: transactionsCount[0]?.value ?? 0,
			accounts: accountsCount[0]?.value ?? 0,
			categories: categoriesCount[0]?.value ?? 0,
			rules: rulesCount[0]?.value ?? 0,
			tags: tagsCount[0]?.value ?? 0,
			tagRules: tagRulesCount[0]?.value ?? 0,
			recurring: recurringCount[0]?.value ?? 0,
			reports: reportsCount[0]?.value ?? 0,
			uploads: uploadsCount[0]?.value ?? 0,
			chat: conversationsCount[0]?.value ?? 0,
			prompts: promptsCount[0]?.value ?? 0
		}
	};
};
