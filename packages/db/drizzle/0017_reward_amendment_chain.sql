DROP INDEX "reward_config_amendments_epoch";--> statement-breakpoint
CREATE UNIQUE INDEX "reward_config_amendments_epoch_from" ON "reward_config_amendments" USING btree ("epoch_id","from_config_id");