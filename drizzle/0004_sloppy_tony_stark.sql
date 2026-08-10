ALTER TABLE `user` ADD `ai_categorization_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `ai_report_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `ai_chat_enabled` integer DEFAULT true NOT NULL;