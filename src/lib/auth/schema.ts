// Drizzle schema for the Better Auth tables.
// Copy these definitions into your main schema.ts.
// Adapt the table names if needed (e.g. usePlural).

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Users table — Better Auth expects: id, name, email, emailVerified, createdAt, updatedAt
// Add the app's own fields after these (e.g. timezone, defaultCurrency).
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

// Sessions table — Better Auth expects: id, userId, token, expiresAt, createdAt, updatedAt
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

// Auth accounts table — Better Auth expects: id, userId, accountId, providerId, password, createdAt, updatedAt
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
