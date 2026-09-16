CREATE TYPE "public"."contribution_kind" AS ENUM('reply', 'quote', 'post', 'text');--> statement-breakpoint
CREATE TYPE "public"."epoch_status" AS ENUM('open', 'closed', 'published');--> statement-breakpoint
CREATE TYPE "public"."link_method" AS ENUM('paste', 'signature');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('raid', 'open');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('proposed', 'rejected', 'open', 'closed');--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mint" text NOT NULL,
	"name" text NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"admin_telegram_user_id" bigint NOT NULL,
	"rubric_version" text NOT NULL,
	"rubric" jsonb NOT NULL,
	"publisher_pubkey" text,
	"chain_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communities_mint_unique" UNIQUE("mint"),
	CONSTRAINT "communities_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"task_id" uuid,
	"kind" "contribution_kind" NOT NULL,
	"url" text,
	"text" text NOT NULL,
	"oembed" jsonb,
	"telegram_message_id" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epochs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"status" "epoch_status" DEFAULT 'open' NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"root" text,
	"pot_lamports" bigint,
	"rubric_hash" text,
	"publish_tx" text,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"epoch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"wallet" text NOT NULL,
	"score" bigint NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"evidence_hash" text NOT NULL,
	"proof" jsonb NOT NULL,
	"claim_tx" text
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"telegram_username" text,
	"wallet" text NOT NULL,
	"x_handle" text,
	"link_method" "link_method" NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"model" text NOT NULL,
	"rubric_version" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"score" integer NOT NULL,
	"timing_multiplier_bps" integer NOT NULL,
	"flags" jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"cost_micro_usd" integer NOT NULL,
	"evidence_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_runs_evidence_hash_unique" UNIQUE("evidence_hash")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"kind" "task_kind" NOT NULL,
	"status" "task_status" NOT NULL,
	"target_url" text,
	"target_text" text,
	"target_author" text,
	"brief" text DEFAULT '' NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"proposed_by" uuid,
	"proposal_score" integer,
	"proposal_reasoning" text,
	"telegram_message_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epochs" ADD CONSTRAINT "epochs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_runs" ADD CONSTRAINT "scoring_runs_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_proposed_by_members_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_community_submitted" ON "contributions" USING btree ("community_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "epochs_community_index" ON "epochs" USING btree ("community_id","index");--> statement-breakpoint
CREATE UNIQUE INDEX "leaves_epoch_wallet" ON "leaves" USING btree ("epoch_id","wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "members_community_tg" ON "members" USING btree ("community_id","telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_community_wallet" ON "members" USING btree ("community_id","wallet");