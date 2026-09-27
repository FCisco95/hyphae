CREATE TABLE "epoch_publication_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"manifest_hash" text NOT NULL,
	"manifest" text NOT NULL,
	CONSTRAINT "epoch_publication_members_hash" CHECK ("epoch_publication_members"."manifest_hash" = encode(sha256(convert_to('hyphae/member-epoch/v1', 'UTF8') || '\x00'::bytea || convert_to("epoch_publication_members"."manifest", 'UTF8')), 'hex'))
);
--> statement-breakpoint
CREATE TABLE "epoch_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"epoch_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"community_address" text NOT NULL,
	"root" text NOT NULL,
	"audit_hash" text NOT NULL,
	"audit_manifest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "epoch_publications_root_format" CHECK ("epoch_publications"."root" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "epoch_publications_audit_hash" CHECK ("epoch_publications"."audit_hash" = encode(sha256(convert_to('hyphae/epoch-audit/v1', 'UTF8') || '\x00'::bytea || convert_to("epoch_publications"."audit_manifest", 'UTF8')), 'hex'))
);
--> statement-breakpoint
ALTER TABLE "epoch_publication_members" ADD CONSTRAINT "epoch_publication_members_publication_id_epoch_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."epoch_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_publication_members" ADD CONSTRAINT "epoch_publication_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_publications" ADD CONSTRAINT "epoch_publications_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epoch_publications" ADD CONSTRAINT "epoch_publications_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "epoch_publication_members_publication_member" ON "epoch_publication_members" USING btree ("publication_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "epoch_publications_epoch" ON "epoch_publications" USING btree ("epoch_id");