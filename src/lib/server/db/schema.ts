import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

// The `user` table — Better Auth's shape plus TabelaFin's own fields.
// Better Auth owns authentication (email/password, sessions); the extra fields
// (timezone, default_currency) belong to the app.
export const users = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull().default(''),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	// TabelaFin's own fields
	timezone: text('timezone').notNull().default('UTC'),
	defaultCurrency: text('default_currency').notNull().default('BRL'),
	// Hide every mention of and feature around AI in the user's UI.
	hideAi: integer('hide_ai', { mode: 'boolean' }).notNull().default(false),
	// Per-feature AI toggles — `hideAi` is the master switch (hides everything);
	// these control each feature individually.
	aiCategorizationEnabled: integer('ai_categorization_enabled', { mode: 'boolean' })
		.notNull()
		.default(true),
	aiReportEnabled: integer('ai_report_enabled', { mode: 'boolean' }).notNull().default(true),
	aiChatEnabled: integer('ai_chat_enabled', { mode: 'boolean' }).notNull().default(true),
	// Has the onboarding been seen? When false, the first visit to the app opens
	// the configuration modal (see OnboardingModal.svelte).
	seenOnboarding: integer('seen_onboarding', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Better Auth sessions — each login creates one, with a token and an expiry.
export const sessions = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Better Auth's auth accounts — each provider (email/password, OAuth) gets an
// entry here. Named "accounts" (plural) because that is the name Better Auth
// looks for with usePlural: true.
export const authAccounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// AI BYOK — see ESCOPO.md §2.2.
export const aiCredentials = sqliteTable('ai_credentials', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	keyEncrypted: text('key_encrypted').notNull(),
	nonce: text('nonce').notNull(),
	// Encryption scheme version — see server/crypto.ts. Null means v1, written
	// before the field existed.
	v: integer('v')
});

// The Meu Pluggy session (JWT access token) — see ESCOPO.md §2.3.
export const pluggyCredentials = sqliteTable('pluggy_credentials', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	tokenEncrypted: text('token_encrypted').notNull(),
	tokenNonce: text('token_nonce').notNull(),
	// Encryption scheme version — see server/crypto.ts.
	v: integer('v'),
	// When the stored JWT expires (its `exp` claim). The token lasts ~24h; the
	// extension refreshes it when the user opens Meu Pluggy. Lets the UI show
	// "expirado" instead of claiming the Open Finance connection is alive.
	tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const pluggyItems = sqliteTable('pluggy_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	pluggyItemId: text('pluggy_item_id').notNull().unique(),
	institutionName: text('institution_name').notNull(),
	institutionType: text('institution_type').notNull(),
	status: text('status').notNull(),
	lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' })
});

// Financial accounts (Nubank, XP...) pulled from Pluggy.
// Named "finance_accounts" to avoid colliding with Better Auth's "accounts".
export const financeAccounts = sqliteTable('finance_accounts', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	pluggyItemId: text('pluggy_item_id')
		.notNull()
		.references(() => pluggyItems.id, { onDelete: 'cascade' }),
	pluggyAccountId: text('pluggy_account_id').notNull().unique(),
	institution: text('institution').notNull(),
	type: text('type').notNull(),
	name: text('name').notNull(),
	currency: text('currency').notNull().default('BRL'),
	cachedBalance: real('cached_balance').notNull().default(0)
});

export const transactions = sqliteTable('transactions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: text('account_id').references(() => financeAccounts.id, {
		onDelete: 'set null'
	}),
	pluggyTransactionId: text('pluggy_transaction_id').unique(),
	statementUploadId: text('statement_upload_id').references(() => statementUploads.id, {
		onDelete: 'set null'
	}),
	date: integer('date', { mode: 'timestamp' }).notNull(),
	description: text('description').notNull(),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('BRL'),
	source: text('source').notNull(),
	// The raw category as it comes from the Meu Pluggy API (e.g. "Investments",
	// "Same person transfer", "Credit card payment"). Used to spot internal
	// transfers and investment movements, which do NOT count as spending or
	// income on the dashboard — distinct from `category`, which is TabelaFin's
	// own categorisation by AI/rules.
	pluggyCategory: text('pluggy_category'),
	category: text('category'),
	categorySource: text('category_source'),
	dedupeHash: text('dedupe_hash'),
	supersededByTransactionId: text('superseded_by_transaction_id')
});

export const statementUploads = sqliteTable('statement_uploads', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	status: text('status').notNull().default('pending'),
	errorMessage: text('error_message'),
	transactionCount: integer('transaction_count').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const monthlyReports = sqliteTable('monthly_reports', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	yearMonth: text('year_month').notNull(),
	summaryJson: text('summary_json').notNull(),
	modelUsed: text('model_used').notNull(),
	generatedAt: integer('generated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Per-user customisable AI prompts — they control how the AI categorises,
// writes reports and answers in the chat. Each field has a hardcoded default
// used when the user has not customised it.
export const userAiPrompts = sqliteTable('user_ai_prompts', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	categorizationPrompt: text('categorization_prompt'),
	reportPrompt: text('report_prompt'),
	chatSystemPrompt: text('chat_system_prompt'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Recurring expenses — subscriptions and fixed costs that repeat.
// Added by the user, by hand.
export const recurringExpenses = sqliteTable('recurring_expenses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	description: text('description').notNull(),
	amount: real('amount').notNull(),
	category: text('category'),
	// 'monthly' | 'yearly' | 'weekly' | 'quarterly'
	frequency: text('frequency').notNull().default('monthly'),
	nextChargeDate: integer('next_charge_date', { mode: 'timestamp' }),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// AI chat conversations — each one groups a set of messages.
export const chatConversations = sqliteTable('chat_conversations', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull().default('Nova conversa'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// AI chat messages — each one belongs to a conversation.
export const chatMessages = sqliteTable('chat_messages', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	conversationId: text('conversation_id')
		.notNull()
		.references(() => chatConversations.id, { onDelete: 'cascade' }),
	role: text('role').notNull(), // 'user' | 'assistant'
	content: text('content').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// The user's transaction categories — these replace the fixed
// TRANSACTION_CATEGORIES list: every user has their own (name + Catppuccin
// colour) and can add, rename or delete them. New users are seeded with the 12
// defaults on signup.
export const userCategories = sqliteTable(
	'user_categories',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color').notNull().default('ctp-overlay1'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.userId, table.name] })]
);

// Automatic categorisation rules — when the user categorises a transaction by
// hand, a rule is created tying that exact description to the category. Every
// future transaction with the same description is born already categorised
// (categorySource='rule').
export const categorizationRules = sqliteTable(
	'categorization_rules',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		description: text('description').notNull(),
		category: text('category').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		// One rule per description per user — categorising again overwrites it.
		uniqueIndex('categorization_rules_user_description').on(table.userId, table.description)
	]
);

// Tags — ad-hoc groupings orthogonal to categories (a one-off "Viagem SP"
// without creating a category for it). Manual only: the AI/rules never read or
// write tags, and categories stay the recurring bucket.
export const tags = sqliteTable(
	'tags',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('tags_user_name').on(table.userId, table.name)]
);

// Junction — a transaction can carry many tags; a tag many transactions.
export const transactionTags = sqliteTable(
	'transaction_tags',
	{
		transactionId: text('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.transactionId, table.tagId] })]
);

// Automatic tag rules, one row per description + tag: whenever a transaction
// arrives with that exact description, the tag is added automatically (mirrors
// the categorisation rules, but for the many-to-many tag set — a description can
// map to several tags). Created from the transaction detail (the Tags card) or
// by hand on the tags page; applied idempotently by the sync.
export const tagRules = sqliteTable(
	'tag_rules',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		description: text('description').notNull(),
		tagName: text('tag_name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		uniqueIndex('tag_rules_user_description_tag').on(table.userId, table.description, table.tagName)
	]
);
