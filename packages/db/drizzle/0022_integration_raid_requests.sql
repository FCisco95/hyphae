CREATE TABLE "integration_raid_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"key_id" text NOT NULL,
	"actor_organic_user_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"task_id" uuid NOT NULL,
	"state" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "integration_raid_requests_role" CHECK ("integration_raid_requests"."actor_role" in ('admin', 'steward')),
	CONSTRAINT "integration_raid_requests_hash" CHECK ("integration_raid_requests"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "integration_raid_requests_state" CHECK (("integration_raid_requests"."state" = 'announcing' and "integration_raid_requests"."response" is null and "integration_raid_requests"."completed_at" is null) or ("integration_raid_requests"."state" = 'created' and "integration_raid_requests"."response" is not null and "integration_raid_requests"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "integration_raid_requests" ADD CONSTRAINT "integration_raid_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_raid_requests" ADD CONSTRAINT "integration_raid_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_raid_requests_key" ON "integration_raid_requests" USING btree ("community_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_raid_requests_task" ON "integration_raid_requests" USING btree ("task_id");