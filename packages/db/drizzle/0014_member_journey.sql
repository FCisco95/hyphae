CREATE TABLE "raid_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_telegram_user_id" bigint NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"telegram_message_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raid_lifecycle_events_action" CHECK ("raid_lifecycle_events"."action" in ('opened', 'closed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "raid_submission_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"artifact_key" text NOT NULL,
	"relation_status" text DEFAULT 'unverified' NOT NULL,
	"ownership_status" text DEFAULT 'unverified' NOT NULL,
	"queue_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raid_submission_receipts_session_id_unique" UNIQUE("session_id"),
	CONSTRAINT "raid_submission_receipts_contribution_id_unique" UNIQUE("contribution_id"),
	CONSTRAINT "raid_submission_receipts_queue" CHECK ("raid_submission_receipts"."queue_status" in ('pending', 'queued')),
	CONSTRAINT "raid_submission_receipts_verification" CHECK ("raid_submission_receipts"."relation_status" = 'unverified' and "raid_submission_receipts"."ownership_status" = 'unverified')
);
--> statement-breakpoint
CREATE TABLE "raid_submission_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"prompt_message_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raid_submission_sessions_kind" CHECK ("raid_submission_sessions"."kind" in ('reply', 'quote')),
	CONSTRAINT "raid_submission_sessions_user" CHECK ("raid_submission_sessions"."telegram_user_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "submission_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"telegram_message_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raid_lifecycle_events" ADD CONSTRAINT "raid_lifecycle_events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_lifecycle_events" ADD CONSTRAINT "raid_lifecycle_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_receipts" ADD CONSTRAINT "raid_submission_receipts_session_id_raid_submission_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."raid_submission_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_receipts" ADD CONSTRAINT "raid_submission_receipts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_receipts" ADD CONSTRAINT "raid_submission_receipts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_receipts" ADD CONSTRAINT "raid_submission_receipts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_receipts" ADD CONSTRAINT "raid_submission_receipts_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_sessions" ADD CONSTRAINT "raid_submission_sessions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_submission_sessions" ADD CONSTRAINT "raid_submission_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_issues" ADD CONSTRAINT "submission_issues_receipt_id_raid_submission_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."raid_submission_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_issues" ADD CONSTRAINT "submission_issues_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_issues" ADD CONSTRAINT "submission_issues_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raid_lifecycle_events_transition" ON "raid_lifecycle_events" USING btree ("task_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_submission_receipts_artifact" ON "raid_submission_receipts" USING btree ("community_id","artifact_key");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_submission_sessions_prompt" ON "raid_submission_sessions" USING btree ("telegram_user_id","prompt_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_issues_retry" ON "submission_issues" USING btree ("receipt_id","telegram_message_id");