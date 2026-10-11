CREATE TABLE "raid_recaps" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"community_id" uuid NOT NULL,
	"status" "raid_delivery_status" NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"retry_used" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"telegram_message_id" integer,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "raid_recaps" ADD CONSTRAINT "raid_recaps_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_recaps" ADD CONSTRAINT "raid_recaps_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;