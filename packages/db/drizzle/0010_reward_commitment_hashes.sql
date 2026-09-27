ALTER TABLE "reward_configs" ADD COLUMN "config_hash" text;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD COLUMN "decision_hash" text;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD COLUMN "evidence_hash" text;--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD COLUMN "decision_hash" text;--> statement-breakpoint
ALTER TABLE "reward_configs" ADD CONSTRAINT "reward_configs_hash_format" CHECK ("reward_configs"."config_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_hash_format" CHECK ("reward_decisions"."decision_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_hash_format" CHECK ("reward_intakes"."evidence_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD CONSTRAINT "reward_snapshot_entries_hash_format" CHECK ("reward_snapshot_entries"."decision_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD CONSTRAINT "reward_snapshot_entries_hash_selected" CHECK ("reward_snapshot_entries"."decision_id" is not null or "reward_snapshot_entries"."decision_hash" is null);
