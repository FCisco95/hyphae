CREATE TABLE "shared_handle_clearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"note" text NOT NULL,
	"cleared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shared_handle_clearances" ADD CONSTRAINT "shared_handle_clearances_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_handle_clearances" ADD CONSTRAINT "shared_handle_clearances_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_handle_clearances" ADD CONSTRAINT "shared_handle_clearances_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shared_handle_clearances_epoch_member" ON "shared_handle_clearances" USING btree ("epoch_id","member_id");