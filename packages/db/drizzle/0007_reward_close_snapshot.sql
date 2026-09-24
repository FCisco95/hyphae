CREATE TYPE "public"."reward_snapshot_reason" AS ENUM('pending_at_close', 'pending_reconciliation', 'excluded');--> statement-breakpoint
ALTER TYPE "public"."reward_nomination_state" ADD VALUE 'expired_at_close';--> statement-breakpoint
ALTER TYPE "public"."reward_nomination_state" ADD VALUE 'completed_after_cutoff';--> statement-breakpoint
CREATE TABLE "reward_epoch_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"cutoff_assumption" text NOT NULL,
	CONSTRAINT "reward_epoch_snapshots_epoch_id_unique" UNIQUE("epoch_id")
);
--> statement-breakpoint
CREATE TABLE "reward_snapshot_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"decision_id" uuid,
	"revision" integer,
	"reason" "reward_snapshot_reason",
	"point_units" bigint NOT NULL,
	CONSTRAINT "reward_snapshot_entries_selected_or_reason" CHECK (("reward_snapshot_entries"."decision_id" is null) = ("reward_snapshot_entries"."revision" is null) and ("reward_snapshot_entries"."decision_id" is null) <> ("reward_snapshot_entries"."reason" is null) and ("reward_snapshot_entries"."reason" is null or "reward_snapshot_entries"."point_units" = 0))
);
--> statement-breakpoint
CREATE TABLE "reward_snapshot_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"point_units" bigint NOT NULL,
	"whole_points" bigint NOT NULL,
	CONSTRAINT "reward_snapshot_members_nonnegative" CHECK ("reward_snapshot_members"."point_units" >= 0 and "reward_snapshot_members"."whole_points" >= 0),
	CONSTRAINT "reward_snapshot_members_whole_points" CHECK ("reward_snapshot_members"."whole_points" = ("reward_snapshot_members"."point_units" + 50000000) / 100000000)
);
--> statement-breakpoint
DROP INDEX "reward_intakes_community_artifact";--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD COLUMN "reentry_of" uuid;--> statement-breakpoint
ALTER TABLE "reward_epoch_snapshots" ADD CONSTRAINT "reward_epoch_snapshots_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_epoch_snapshots" ADD CONSTRAINT "reward_epoch_snapshots_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD CONSTRAINT "reward_snapshot_entries_snapshot_id_reward_epoch_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."reward_epoch_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD CONSTRAINT "reward_snapshot_entries_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD CONSTRAINT "reward_snapshot_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_snapshot_entries" ADD CONSTRAINT "reward_snapshot_entries_decision_id_reward_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."reward_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_snapshot_members" ADD CONSTRAINT "reward_snapshot_members_snapshot_id_reward_epoch_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."reward_epoch_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_snapshot_members" ADD CONSTRAINT "reward_snapshot_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_snapshot_entries_snapshot_contribution" ON "reward_snapshot_entries" USING btree ("snapshot_id","contribution_id");--> statement-breakpoint
CREATE INDEX "reward_snapshot_entries_contribution" ON "reward_snapshot_entries" USING btree ("contribution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_snapshot_members_snapshot_member" ON "reward_snapshot_members" USING btree ("snapshot_id","member_id");--> statement-breakpoint
CREATE INDEX "reward_snapshot_members_member" ON "reward_snapshot_members" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "reward_intakes" ADD CONSTRAINT "reward_intakes_reentry_of_reward_intakes_id_fk" FOREIGN KEY ("reentry_of") REFERENCES "public"."reward_intakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_intakes_epoch_artifact" ON "reward_intakes" USING btree ("epoch_id","artifact_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_intakes_community_artifact" ON "reward_intakes" USING btree ("community_id","artifact_key") WHERE "reward_intakes"."reentry_of" is null;