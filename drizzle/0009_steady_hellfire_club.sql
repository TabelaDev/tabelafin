-- One migration for the whole change: adds `pluggy_items.last_sync_attempt_at`,
-- indexes `transactions`, and moves money from float reais to integer centavos
-- (see src/lib/lib/money.ts).
--
-- Hand-edited after `drizzle-kit generate`, which gets two things wrong here:
--
--   1. It copies the amounts across verbatim. SQLite's INTEGER affinity only
--      converts a REAL when the conversion is lossless, so 782.54 would be
--      stored *as 782.54* in a column the app now reads as centavos — every
--      value silently divided by 100, with no error anywhere. The SELECTs
--      multiply and round instead.
--
--   2. It re-enables foreign keys after the finance_accounts rebuild, before
--      the transactions one. `transaction_tags` references `transactions(id)`
--      ON DELETE CASCADE, so `DROP TABLE transactions` with keys enabled would
--      cascade and silently empty every tag link. The pragma now spans the
--      whole migration.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_finance_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pluggy_item_id` text NOT NULL,
	`pluggy_account_id` text NOT NULL,
	`institution` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`cached_balance` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pluggy_item_id`) REFERENCES `pluggy_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_finance_accounts`("id", "user_id", "pluggy_item_id", "pluggy_account_id", "institution", "type", "name", "currency", "cached_balance") SELECT "id", "user_id", "pluggy_item_id", "pluggy_account_id", "institution", "type", "name", "currency", CAST(ROUND("cached_balance" * 100) AS INTEGER) FROM `finance_accounts`;--> statement-breakpoint
DROP TABLE `finance_accounts`;--> statement-breakpoint
ALTER TABLE `__new_finance_accounts` RENAME TO `finance_accounts`;--> statement-breakpoint
CREATE UNIQUE INDEX `finance_accounts_pluggy_account_id_unique` ON `finance_accounts` (`pluggy_account_id`);--> statement-breakpoint
CREATE TABLE `__new_recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`category` text,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`next_charge_date` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recurring_expenses`("id", "user_id", "description", "amount", "category", "frequency", "next_charge_date", "is_active", "created_at", "updated_at") SELECT "id", "user_id", "description", CAST(ROUND("amount" * 100) AS INTEGER), "category", "frequency", "next_charge_date", "is_active", "created_at", "updated_at" FROM `recurring_expenses`;--> statement-breakpoint
DROP TABLE `recurring_expenses`;--> statement-breakpoint
ALTER TABLE `__new_recurring_expenses` RENAME TO `recurring_expenses`;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`pluggy_transaction_id` text,
	`statement_upload_id` text,
	`date` integer NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`source` text NOT NULL,
	`pluggy_category` text,
	`category` text,
	`category_source` text,
	`dedupe_hash` text,
	`superseded_by_transaction_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`statement_upload_id`) REFERENCES `statement_uploads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "user_id", "account_id", "pluggy_transaction_id", "statement_upload_id", "date", "description", "amount", "currency", "source", "pluggy_category", "category", "category_source", "dedupe_hash", "superseded_by_transaction_id") SELECT "id", "user_id", "account_id", "pluggy_transaction_id", "statement_upload_id", "date", "description", CAST(ROUND("amount" * 100) AS INTEGER), "currency", "source", "pluggy_category", "category", "category_source", "dedupe_hash", "superseded_by_transaction_id" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_pluggy_transaction_id_unique` ON `transactions` (`pluggy_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`);--> statement-breakpoint
ALTER TABLE `pluggy_items` ADD `last_sync_attempt_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=ON;
