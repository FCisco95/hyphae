CREATE TYPE "public"."hold_check_status" AS ENUM('pending', 'holder', 'below', 'uncertain');--> statement-breakpoint
CREATE TABLE "hold_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"wallet" text NOT NULL,
	"mint" text NOT NULL,
	"threshold_raw" numeric(20, 0) NOT NULL,
	"check_round" uuid NOT NULL,
	"status" "hold_check_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"raw_amount" numeric(20, 0),
	"decimals" integer,
	"provider" text,
	"slot" numeric(20, 0),
	"observed_at" timestamp (3) with time zone,
	"checked_at" timestamp (3) with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hold_checks_threshold_positive" CHECK ("hold_checks"."threshold_raw" > 0),
	CONSTRAINT "hold_checks_observation" CHECK (("hold_checks"."status" in ('holder', 'below')) = ("hold_checks"."raw_amount" is not null and "hold_checks"."decimals" is not null and "hold_checks"."provider" is not null and "hold_checks"."slot" is not null and "hold_checks"."observed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "rules_test_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"test_id" text NOT NULL,
	"passed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "first_paid_epoch" integer;--> statement-breakpoint
ALTER TABLE "hold_checks" ADD CONSTRAINT "hold_checks_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold_checks" ADD CONSTRAINT "hold_checks_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold_checks" ADD CONSTRAINT "hold_checks_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules_test_passes" ADD CONSTRAINT "rules_test_passes_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules_test_passes" ADD CONSTRAINT "rules_test_passes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hold_checks_epoch_member" ON "hold_checks" USING btree ("epoch_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rules_test_passes_member_test" ON "rules_test_passes" USING btree ("member_id","test_id");--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_first_paid_epoch_positive" CHECK ("communities"."first_paid_epoch" is null or "communities"."first_paid_epoch" >= 1);