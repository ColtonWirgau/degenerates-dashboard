ALTER TABLE "polls" ADD COLUMN "template_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "polls_league_template_unique" ON "polls" USING btree ("league_id","template_key");