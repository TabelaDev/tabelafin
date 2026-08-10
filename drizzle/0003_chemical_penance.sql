CREATE TABLE `categorization_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorization_rules_user_description` ON `categorization_rules` (`user_id`,`description`);--> statement-breakpoint
CREATE TABLE `user_categories` (
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'ctp-overlay1' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `name`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
