import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Tabela `user` — formato Better Auth + campos próprios do TabelaFin.
// Better Auth gerencia autenticação (email/senha, sessões); campos extras
// (timezone, default_currency) são do app.
export const users = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull().default(''),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	// Campos próprios do TabelaFin
	timezone: text('timezone').notNull().default('UTC'),
	defaultCurrency: text('default_currency').notNull().default('BRL'),
	// Ocultar qualquer menção/feature de IA na UI do usuário.
	hideAi: integer('hide_ai', { mode: 'boolean' }).notNull().default(false),
	// Toggles por funcionalidade de IA — o `hideAi` é o master (esconde tudo);
	// estes controlam cada feature individualmente.
	aiCategorizationEnabled: integer('ai_categorization_enabled', { mode: 'boolean' })
		.notNull()
		.default(true),
	aiReportEnabled: integer('ai_report_enabled', { mode: 'boolean' }).notNull().default(true),
	aiChatEnabled: integer('ai_chat_enabled', { mode: 'boolean' }).notNull().default(true),
	// Já viu o onboarding? Quando false, o primeiro acesso ao app
	// mostra o modal de configuração (ver OnboardingModal.svelte).
	seenOnboarding: integer('seen_onboarding', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Sessões do Better Auth — cada login gera uma sessão com token e expiration.
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

// Contas de autenticação do Better Auth — cada provider (email/senha, OAuth)
// gera uma entrada aqui. Nome "accounts" (plural) porque Better Auth com
// usePlural: true procura esse nome.
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

// BYOK de IA — ver ESCOPO.md §2.2.
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

// Sessão do Meu Pluggy (JWT access token) — ver ESCOPO.md §2.3.
export const pluggyCredentials = sqliteTable('pluggy_credentials', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	tokenEncrypted: text('token_encrypted').notNull(),
	tokenNonce: text('token_nonce').notNull(),
	// Encryption scheme version — see server/crypto.ts.
	v: integer('v'),
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

// Contas financeiras (Nubank, XP...) puxadas da Pluggy.
// Nome "finance_accounts" pra evitar colisão com a tabela Better Auth "accounts".
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
	// Categoria bruta que vem da API do Meu Pluggy (ex: "Investments",
	// "Same person transfer", "Credit card payment"). Usada pra detectar
	// transferência interna/movimentação de investimento que NÃO conta como
	// gasto/receita no dashboard — diferente de `category` (a categorização
	// do TabelaFin, por IA/regras).
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

// Prompts customizáveis de IA por usuário — controla como a IA categoriza,
// gera relatórios e responde no chat. Cada campo tem um default hardcoded
// usado quando o usuário não customizou.
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

// Gastos recorrentes — assinaturas e despesas fixas que se repetem.
// Adicionados manualmente pelo usuário.
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

// Conversas do chat IA — cada conversa agrupa mensagens.
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

// Mensagens do chat IA — cada mensagem pertence a uma conversa.
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

// Categorias de transação do usuário — substitui a lista fixa de
// TRANSACTION_CATEGORIES: cada usuário tem suas próprias categorias (nome +
// cor Catppuccin), podendo adicionar/renomear/excluir. Usuários novos
// recebem as 12 categorias padrão ao se cadastrar.
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

// Regras de categorização automática — quando o usuário categoriza uma
// transação manualmente, uma regra é criada ligando a descrição exata à
// categoria. Toda transação futura com a mesma descrição nasce já
// categorizada (categorySource='rule').
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
		// Uma regra por descrição por usuário — categorizar de novo sobrescreve.
		uniqueIndex('categorization_rules_user_description').on(table.userId, table.description)
	]
);
