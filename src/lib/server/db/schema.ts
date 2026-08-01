import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	timezone: text('timezone').notNull().default('UTC'),
	defaultCurrency: text('default_currency').notNull().default('BRL'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// BYOK de IA — ver ESCOPO.md §2.2. Mesmo formato do TabelaCal (reuso direto).
export const aiCredentials = sqliteTable('ai_credentials', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	keyEncrypted: text('key_encrypted').notNull(),
	nonce: text('nonce').notNull()
});

// Client ID/Secret do próprio Meu Pluggy do usuário — ver ESCOPO.md §2.3.
// Nonce separado por segredo: AES-GCM quebra a confidencialidade se o mesmo
// nonce for reusado com a mesma chave pra cifrar dois textos diferentes.
export const pluggyCredentials = sqliteTable('pluggy_credentials', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	clientIdEncrypted: text('client_id_encrypted').notNull(),
	clientIdNonce: text('client_id_nonce').notNull(),
	clientSecretEncrypted: text('client_secret_encrypted').notNull(),
	clientSecretNonce: text('client_secret_nonce').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Um Client ID/Secret do Meu Pluggy pode conectar múltiplos logins bancários
// (Nubank, XP...) — cada conexão vira um "item" na API da Pluggy.
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
	// 'updating' | 'updated' | 'login_error' | 'outdated' | 'waiting_user_input'
	// (espelha os status da Pluggy, ver docs.pluggy.ai/docs/item-status)
	status: text('status').notNull(),
	lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' })
});

// Contas puxadas da Pluggy (conta/cartão/investimento).
export const accounts = sqliteTable('accounts', {
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
	// 'checking' | 'credit_card' | 'investment'
	type: text('type').notNull(),
	name: text('name').notNull(),
	currency: text('currency').notNull().default('BRL'),
	cachedBalance: real('cached_balance').notNull().default(0)
});

// Transações unificadas: origem Pluggy (sync automático) ou PDF (fallback
// manual, ESCOPO.md §2.4). accountId é opcional porque um upload de PDF pode
// não bater imediatamente com uma conta já sincronizada.
export const transactions = sqliteTable('transactions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
	pluggyTransactionId: text('pluggy_transaction_id').unique(),
	statementUploadId: text('statement_upload_id').references(() => statementUploads.id, {
		onDelete: 'set null'
	}),
	date: integer('date', { mode: 'timestamp' }).notNull(),
	description: text('description').notNull(),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('BRL'),
	// 'pluggy' | 'pdf_upload'
	source: text('source').notNull(),
	category: text('category'),
	// 'ai' | 'user' — categoria corrigida manualmente (category_source='user')
	// nunca é sobrescrita por rodadas futuras de categorização em lote.
	categorySource: text('category_source'),
	// Hash de (conta/valor/data) usado pra achar candidatos a duplicata entre
	// uma transação vinda de PDF e a mesma transação chegando depois via sync
	// da Pluggy (ver regra de dedupe no ESCOPO.md §5).
	dedupeHash: text('dedupe_hash'),
	// Quando não-nulo, esta linha foi superada por uma transação da Pluggy
	// equivalente — mantida pra auditoria, mas excluída de toda query de
	// dashboard/relatório (`WHERE superseded_by_transaction_id IS NULL`).
	supersededByTransactionId: text('superseded_by_transaction_id')
});

// Uploads de PDF de fatura/extrato (fallback manual). O arquivo em si nunca é
// persistido (ESCOPO.md §4 "Fora de escopo") — só o resultado estruturado nas
// transações vinculadas via statement_upload_id.
export const statementUploads = sqliteTable('statement_uploads', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	// 'pending' | 'processing' | 'completed' | 'failed'
	status: text('status').notNull().default('pending'),
	errorMessage: text('error_message'),
	transactionCount: integer('transaction_count').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Cache do relatório mensal gerado pelo cron do dia 1 (ESCOPO.md §3.6).
export const monthlyReports = sqliteTable('monthly_reports', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	// formato 'YYYY-MM', referente ao mês do relatório (não à data de geração)
	yearMonth: text('year_month').notNull(),
	summaryJson: text('summary_json').notNull(),
	modelUsed: text('model_used').notNull(),
	generatedAt: integer('generated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Inscrições de Web Push (PushManager.subscribe()) — uma por dispositivo/
// navegador do usuário, usada pra avisar quando o relatório mensal fica
// pronto (ESCOPO.md §3.6). Mesmo formato do TabelaCal (reuso direto).
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
