CREATE TABLE `statement_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`bank` text,
	`filename` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`extracted_json` text,
	`approved_json` text,
	`transaction_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`applied_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
