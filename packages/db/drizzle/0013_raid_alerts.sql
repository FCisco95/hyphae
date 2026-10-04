CREATE TYPE "public"."raid_delivery_status" AS ENUM('pending', 'sending', 'sent', 'skipped', 'failed', 'uncertain');--> statement-breakpoint
CREATE TABLE "raid_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"telegram_message_id" integer NOT NULL,
	"task_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raid_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"subscription_revision" integer NOT NULL,
	"dispatch_started" boolean DEFAULT false NOT NULL,
	"status" "raid_delivery_status" DEFAULT 'pending' NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"attempted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"reason" text,
	CONSTRAINT "raid_deliveries_user_positive" CHECK ("raid_deliveries"."telegram_user_id" > 0),
	CONSTRAINT "raid_deliveries_revision_positive" CHECK ("raid_deliveries"."subscription_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "raid_subscriptions" (
	"community_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"enabled" boolean NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"enabled_at" timestamp with time zone NOT NULL,
	CONSTRAINT "raid_subscriptions_community_id_telegram_user_id_pk" PRIMARY KEY("community_id","telegram_user_id"),
	CONSTRAINT "raid_subscriptions_user_positive" CHECK ("raid_subscriptions"."telegram_user_id" > 0),
	CONSTRAINT "raid_subscriptions_revision_positive" CHECK ("raid_subscriptions"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "raid_announcements" ADD CONSTRAINT "raid_announcements_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_announcements" ADD CONSTRAINT "raid_announcements_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_deliveries" ADD CONSTRAINT "raid_deliveries_announcement_id_raid_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."raid_announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_subscriptions" ADD CONSTRAINT "raid_subscriptions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raid_announcements_source" ON "raid_announcements" USING btree ("community_id","telegram_chat_id","telegram_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_announcements_task" ON "raid_announcements" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_deliveries_recipient" ON "raid_deliveries" USING btree ("announcement_id","telegram_user_id");--> statement-breakpoint
CREATE INDEX "raid_deliveries_pending" ON "raid_deliveries" USING btree ("status","next_attempt_at");