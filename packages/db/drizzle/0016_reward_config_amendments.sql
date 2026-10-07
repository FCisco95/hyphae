CREATE TABLE "reward_config_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"epoch_id" uuid NOT NULL,
	"from_config_id" uuid NOT NULL,
	"to_config_id" uuid NOT NULL,
	"from_prompt_version" text NOT NULL,
	"from_prompt_template_hash" text NOT NULL,
	"to_prompt_version" text NOT NULL,
	"to_prompt_template_hash" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reward_config_amendments_future" CHECK ("reward_config_amendments"."effective_at" > "reward_config_amendments"."recorded_at"),
	CONSTRAINT "reward_config_amendments_changes" CHECK ("reward_config_amendments"."from_config_id" <> "reward_config_amendments"."to_config_id"),
	CONSTRAINT "reward_config_amendments_hash_format" CHECK ("reward_config_amendments"."from_prompt_template_hash" ~ '^[0-9a-f]{64}$' and "reward_config_amendments"."to_prompt_template_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "reward_config_amendments" ADD CONSTRAINT "reward_config_amendments_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_config_amendments" ADD CONSTRAINT "reward_config_amendments_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_config_amendments" ADD CONSTRAINT "reward_config_amendments_from_config_id_reward_configs_id_fk" FOREIGN KEY ("from_config_id") REFERENCES "public"."reward_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_config_amendments" ADD CONSTRAINT "reward_config_amendments_to_config_id_reward_configs_id_fk" FOREIGN KEY ("to_config_id") REFERENCES "public"."reward_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_config_amendments_epoch" ON "reward_config_amendments" USING btree ("epoch_id");