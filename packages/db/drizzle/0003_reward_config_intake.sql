CREATE TYPE "public"."reward_proposal_status" AS ENUM('pending', 'activated', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TABLE "reward_config_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"proposed_by" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"accepted_in_epoch" integer,
	"earliest_activation_epoch" integer NOT NULL,
	"status" "reward_proposal_status" NOT NULL,
	"activated_epoch_index" integer,
	"resolved_at" timestamp with time zone,
	"resolved_reason" text
);
--> statement-breakpoint
CREATE TABLE "reward_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"payload_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"task_id" uuid,
	"artifact_key" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"capture" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "reward_intake_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "epochs" ADD COLUMN "reward_config_id" uuid;--> statement-breakpoint
ALTER TABLE "reward_config_proposals" ADD CONSTRAINT "reward_config_proposals_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_config_proposals" ADD CONSTRAINT "reward_config_proposals_config_id_reward_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."reward_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_configs" ADD CONSTRAINT "reward_configs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_config_id_reward_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."reward_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_config_proposals_one_pending" ON "reward_config_proposals" USING btree ("community_id") WHERE "reward_config_proposals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "reward_config_proposals_community_accepted" ON "reward_config_proposals" USING btree ("community_id","accepted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_configs_community_digest" ON "reward_configs" USING btree ("community_id","digest");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_intakes_contribution" ON "reward_intakes" USING btree ("contribution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_intakes_community_artifact" ON "reward_intakes" USING btree ("community_id","artifact_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_intakes_community_idempotency" ON "reward_intakes" USING btree ("community_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "reward_intakes_epoch_member" ON "reward_intakes" USING btree ("epoch_id","member_id");--> statement-breakpoint
ALTER TABLE "epochs" ADD CONSTRAINT "epochs_reward_config_id_reward_configs_id_fk" FOREIGN KEY ("reward_config_id") REFERENCES "public"."reward_configs"("id") ON DELETE no action ON UPDATE no action;