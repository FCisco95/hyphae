CREATE TYPE "public"."reward_dispatch_purpose" AS ENUM('quality', 'quality_effort', 'effort');--> statement-breakpoint
CREATE TYPE "public"."reward_dispatch_state" AS ENUM('dispatched', 'completed', 'pending_reconciliation', 'not_sent_proven');--> statement-breakpoint
CREATE TYPE "public"."reward_effort" AS ENUM('eligible', 'ineligible', 'not_nominated');--> statement-breakpoint
CREATE TYPE "public"."reward_nomination_kind" AS ENUM('new_work', 'upgrade');--> statement-breakpoint
CREATE TYPE "public"."reward_nomination_state" AS ENUM('pending_evidence', 'ready', 'evaluating', 'pending_reconciliation', 'completed_eligible', 'completed_ineligible', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."reward_slot_state" AS ENUM('open', 'reserved', 'consumed');--> statement-breakpoint
CREATE TABLE "reward_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"predecessor_id" uuid,
	"dispatch_id" uuid,
	"nomination_id" uuid,
	"raw_quality" integer NOT NULL,
	"credited_quality" integer NOT NULL,
	"flags" jsonb NOT NULL,
	"effort" "reward_effort" NOT NULL,
	"effort_criteria" jsonb,
	"timing_bps" integer NOT NULL,
	"multiplier_bps" integer NOT NULL,
	"point_units" bigint NOT NULL,
	"explanation" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"affects_allocation" boolean NOT NULL,
	CONSTRAINT "reward_decisions_revision_positive" CHECK ("reward_decisions"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "reward_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"nomination_id" uuid,
	"slot_id" uuid,
	"purpose" "reward_dispatch_purpose" NOT NULL,
	"fence" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"state" "reward_dispatch_state" NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"output_hash" text,
	"latency_ms" integer,
	"cost_micro_usd" integer,
	"error" text,
	"dispatched_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"reconcile_reason" text,
	CONSTRAINT "reward_dispatches_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "reward_nominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"candidate_ordinal" integer NOT NULL,
	"contribution_id" uuid NOT NULL,
	"intake_id" uuid NOT NULL,
	"kind" "reward_nomination_kind" NOT NULL,
	"state" "reward_nomination_state" NOT NULL,
	"pending_reason" text,
	"idempotency_key" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reward_nominations_candidate_bound" CHECK ("reward_nominations"."candidate_ordinal" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "reward_retrievals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"outcome" text NOT NULL,
	"limitations" jsonb NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reward_retrievals_round_bound" CHECK ("reward_retrievals"."round" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "reward_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"state" "reward_slot_state" DEFAULT 'open' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"candidates_used" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_decision_id" uuid,
	CONSTRAINT "reward_slots_ordinal_positive" CHECK ("reward_slots"."ordinal" >= 1),
	CONSTRAINT "reward_slots_candidates_bound" CHECK ("reward_slots"."candidates_used" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_config_id_reward_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."reward_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_predecessor_id_reward_decisions_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."reward_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_dispatch_id_reward_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."reward_dispatches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_decisions" ADD CONSTRAINT "reward_decisions_nomination_id_reward_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "public"."reward_nominations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_dispatches" ADD CONSTRAINT "reward_dispatches_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_dispatches" ADD CONSTRAINT "reward_dispatches_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_dispatches" ADD CONSTRAINT "reward_dispatches_nomination_id_reward_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "public"."reward_nominations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_dispatches" ADD CONSTRAINT "reward_dispatches_slot_id_reward_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."reward_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_nominations" ADD CONSTRAINT "reward_nominations_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_nominations" ADD CONSTRAINT "reward_nominations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_nominations" ADD CONSTRAINT "reward_nominations_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_nominations" ADD CONSTRAINT "reward_nominations_slot_id_reward_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."reward_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_nominations" ADD CONSTRAINT "reward_nominations_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_nominations" ADD CONSTRAINT "reward_nominations_intake_id_reward_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."reward_intakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_retrievals" ADD CONSTRAINT "reward_retrievals_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_retrievals" ADD CONSTRAINT "reward_retrievals_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_slots" ADD CONSTRAINT "reward_slots_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_slots" ADD CONSTRAINT "reward_slots_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_slots" ADD CONSTRAINT "reward_slots_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_slots" ADD CONSTRAINT "reward_slots_consumed_decision_id_reward_decisions_id_fk" FOREIGN KEY ("consumed_decision_id") REFERENCES "public"."reward_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_decisions_contribution_revision" ON "reward_decisions" USING btree ("contribution_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_decisions_predecessor" ON "reward_decisions" USING btree ("predecessor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_dispatches_one_per_slot" ON "reward_dispatches" USING btree ("slot_id") WHERE "reward_dispatches"."state" <> 'not_sent_proven';--> statement-breakpoint
CREATE UNIQUE INDEX "reward_dispatches_one_quality" ON "reward_dispatches" USING btree ("contribution_id") WHERE "reward_dispatches"."purpose" = 'quality' and "reward_dispatches"."state" <> 'not_sent_proven';--> statement-breakpoint
CREATE UNIQUE INDEX "reward_nominations_slot_candidate" ON "reward_nominations" USING btree ("slot_id","candidate_ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_nominations_community_idempotency" ON "reward_nominations" USING btree ("community_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_nominations_one_live" ON "reward_nominations" USING btree ("contribution_id") WHERE "reward_nominations"."state" <> 'withdrawn';--> statement-breakpoint
CREATE UNIQUE INDEX "reward_retrievals_contribution_epoch_round" ON "reward_retrievals" USING btree ("contribution_id","epoch_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_slots_epoch_member_ordinal" ON "reward_slots" USING btree ("epoch_id","member_id","ordinal");