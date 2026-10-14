CREATE TYPE "public"."raid_card_format" AS ENUM('photo', 'text');--> statement-breakpoint
CREATE TYPE "public"."raid_card_state" AS ENUM('open', 'ended', 'cancelled', 'gone');--> statement-breakpoint
CREATE TABLE "raid_cards" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"community_id" uuid NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"telegram_message_id" integer NOT NULL,
	"format" "raid_card_format" NOT NULL,
	"state" "raid_card_state" NOT NULL,
	"rendered_hash" text NOT NULL,
	"next_refresh_at" timestamp with time zone,
	"hold_until" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"unpinned_at" timestamp with time zone,
	"pin_error" text,
	"results_message_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raid_cards" ADD CONSTRAINT "raid_cards_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_cards" ADD CONSTRAINT "raid_cards_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "raid_cards_due" ON "raid_cards" USING btree ("next_refresh_at");