ALTER TABLE "members" ALTER COLUMN "wallet" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "link_method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "linked_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_wallet_link_together" CHECK (("members"."wallet" is null) = ("members"."link_method" is null) and ("members"."wallet" is null) = ("members"."linked_at" is null));