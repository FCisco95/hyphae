ALTER TABLE "reward_decisions" ADD COLUMN "correction_actor" text;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD COLUMN "correction_reason" text;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD COLUMN "correction_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_decisions_community_idempotency" ON "reward_decisions" USING btree ("community_id","idempotency_key") WHERE "reward_decisions"."idempotency_key" is not null;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_correction_complete" CHECK (("reward_decisions"."correction_actor" is null) = ("reward_decisions"."correction_reason" is null) and ("reward_decisions"."correction_actor" is null) = ("reward_decisions"."correction_evidence" is null));--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_correction_shape" CHECK ("reward_decisions"."correction_actor" is null or ("reward_decisions"."predecessor_id" is not null and "reward_decisions"."dispatch_id" is null));