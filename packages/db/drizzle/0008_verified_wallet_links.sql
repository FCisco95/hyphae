CREATE TYPE "public"."wallet_proof_status" AS ENUM('pending', 'consumed');--> statement-breakpoint
CREATE TABLE "link_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"telegram_username" text,
	"token_digest" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_sessions_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
CREATE TABLE "member_wallet_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"wallet" text NOT NULL,
	"method" "link_method" NOT NULL,
	"proof_request_id" uuid,
	"valid_from" timestamp (3) with time zone NOT NULL,
	"valid_to" timestamp (3) with time zone,
	CONSTRAINT "member_wallet_links_signature_has_proof" CHECK ("member_wallet_links"."method" <> 'signature' or "member_wallet_links"."proof_request_id" is not null),
	CONSTRAINT "member_wallet_links_interval" CHECK ("member_wallet_links"."valid_to" is null or "member_wallet_links"."valid_to" > "member_wallet_links"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "wallet_proof_requests" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"community_id" uuid NOT NULL,
	"link_session_id" uuid NOT NULL,
	"telegram_user_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"origin" text NOT NULL,
	"chain" text NOT NULL,
	"issued_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"status" "wallet_proof_status" DEFAULT 'pending' NOT NULL,
	"consumed_at" timestamp (3) with time zone,
	CONSTRAINT "wallet_proof_lifetime" CHECK ("wallet_proof_requests"."expires_at" = "wallet_proof_requests"."issued_at" + interval '5 minutes')
);
--> statement-breakpoint
ALTER TABLE "link_sessions" ADD CONSTRAINT "link_sessions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_wallet_links" ADD CONSTRAINT "member_wallet_links_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_wallet_links" ADD CONSTRAINT "member_wallet_links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_wallet_links" ADD CONSTRAINT "member_wallet_links_proof_request_id_wallet_proof_requests_request_id_fk" FOREIGN KEY ("proof_request_id") REFERENCES "public"."wallet_proof_requests"("request_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_proof_requests" ADD CONSTRAINT "wallet_proof_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_proof_requests" ADD CONSTRAINT "wallet_proof_requests_link_session_id_link_sessions_id_fk" FOREIGN KEY ("link_session_id") REFERENCES "public"."link_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_sessions_community_user" ON "link_sessions" USING btree ("community_id","telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_wallet_links_one_current" ON "member_wallet_links" USING btree ("member_id") WHERE "member_wallet_links"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "member_wallet_links_member_from" ON "member_wallet_links" USING btree ("member_id","valid_from");--> statement-breakpoint
CREATE INDEX "wallet_proof_requests_session" ON "wallet_proof_requests" USING btree ("link_session_id");--> statement-breakpoint
-- Every existing member keeps its current (pasted) wallet as an open history row.
INSERT INTO "member_wallet_links" ("community_id", "member_id", "wallet", "method", "valid_from")
SELECT "community_id", "id", "wallet", "link_method", "linked_at" FROM "members";
