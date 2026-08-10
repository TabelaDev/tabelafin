// Schema Drizzle pra tabelas do Better Auth.
// Copie estas definições pro seu schema.ts principal.
// Adapte os nomes de tabela se necessário (ex: usePlural).

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Tabela de usuários — Better Auth espera: id, name, email, emailVerified, createdAt, updatedAt
// Adicione campos próprios do app depois destes (ex: timezone, defaultCurrency).
export const authUser = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull().default(''),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Tabela de sessões — Better Auth espera: id, userId, token, expiresAt, createdAt, updatedAt
export const authSession = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => authUser.id, { onDelete: 'cascade' }),
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

// Tabela de contas de auth — Better Auth espera: id, userId, accountId, providerId, password, createdAt, updatedAt
export const authAccount = sqliteTable('account', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => authUser.id, { onDelete: 'cascade' }),
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
