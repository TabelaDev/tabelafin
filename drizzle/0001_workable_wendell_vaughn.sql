ALTER TABLE `user` ADD `seen_onboarding` integer DEFAULT false NOT NULL;
--> statement-breakpoint
-- Usuários existentes já passaram pelo onboarding; só contas novas
-- (default false) devem ver o wizard de configuração no primeiro acesso.
UPDATE `user` SET `seen_onboarding` = 1;