CREATE TABLE "distribution_publication_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"manifest_hash" text NOT NULL,
	"manifest" text NOT NULL,
	CONSTRAINT "distribution_publication_members_hash" CHECK ("distribution_publication_members"."manifest_hash" = encode(sha256(convert_to('hyphae/member-distribution/v1', 'UTF8') || '\x00'::bytea || convert_to("distribution_publication_members"."manifest", 'UTF8')), 'hex'))
);
--> statement-breakpoint
CREATE TABLE "distribution_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"epoch_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"community_address" text NOT NULL,
	"root" text NOT NULL,
	"audit_hash" text NOT NULL,
	"audit_manifest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "distribution_publications_root_format" CHECK ("distribution_publications"."root" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "distribution_publications_audit_hash" CHECK ("distribution_publications"."audit_hash" = encode(sha256(convert_to('hyphae/distribution-audit/v1', 'UTF8') || '\x00'::bytea || convert_to("distribution_publications"."audit_manifest", 'UTF8')), 'hex'))
);
--> statement-breakpoint
CREATE TABLE "epoch_payout_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"free_lamports" bigint,
	"accrual_lamports" bigint NOT NULL,
	"volume_lamports" bigint,
	"outcome" text NOT NULL,
	"reason" text,
	"distribution_epoch_id" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "epoch_payout_decisions_accrual_nonnegative" CHECK ("epoch_payout_decisions"."accrual_lamports" >= 0),
	CONSTRAINT "epoch_payout_decisions_outcome" CHECK ("epoch_payout_decisions"."outcome" in ('rolled_over', 'distribution_planned', 'distributed')),
	CONSTRAINT "epoch_payout_decisions_distribution" CHECK (("epoch_payout_decisions"."outcome" = 'rolled_over') = ("epoch_payout_decisions"."distribution_epoch_id" is null))
);
--> statement-breakpoint
CREATE TABLE "payout_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"effective_from_index" integer NOT NULL,
	"threshold_volume_lamports" bigint NOT NULL,
	"basis" text NOT NULL,
	"reward_bps_of_volume" integer,
	"auto_publish" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_policies_from_positive" CHECK ("payout_policies"."effective_from_index" >= 1),
	CONSTRAINT "payout_policies_threshold_positive" CHECK ("payout_policies"."threshold_volume_lamports" > 0),
	CONSTRAINT "payout_policies_basis" CHECK ("payout_policies"."basis" in ('cumulative', 'per_epoch')),
	CONSTRAINT "payout_policies_reward_bps" CHECK ("payout_policies"."reward_bps_of_volume" is null or "payout_policies"."reward_bps_of_volume" between 1 and 10000)
);
--> statement-breakpoint
ALTER TABLE "distribution_publication_members" ADD CONSTRAINT "distribution_publication_members_publication_id_distribution_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."distribution_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_publication_members" ADD CONSTRAINT "distribution_publication_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_publications" ADD CONSTRAINT "distribution_publications_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_publications" ADD CONSTRAINT "distribution_publications_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_payout_decisions" ADD CONSTRAINT "epoch_payout_decisions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_payout_decisions" ADD CONSTRAINT "epoch_payout_decisions_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_payout_decisions" ADD CONSTRAINT "epoch_payout_decisions_policy_id_payout_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."payout_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_payout_decisions" ADD CONSTRAINT "epoch_payout_decisions_distribution_epoch_id_epochs_id_fk" FOREIGN KEY ("distribution_epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_policies" ADD CONSTRAINT "payout_policies_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "distribution_publication_members_publication_member" ON "distribution_publication_members" USING btree ("publication_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "distribution_publications_epoch" ON "distribution_publications" USING btree ("epoch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "epoch_payout_decisions_epoch" ON "epoch_payout_decisions" USING btree ("epoch_id");--> statement-breakpoint
CREATE INDEX "epoch_payout_decisions_community" ON "epoch_payout_decisions" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_policies_community_from" ON "payout_policies" USING btree ("community_id","effective_from_index");