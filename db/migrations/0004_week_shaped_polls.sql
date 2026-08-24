ALTER TYPE "public"."week_kind" ADD VALUE 'preseason' BEFORE 'regular';--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "nfl_week_id" uuid;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_nfl_week_id_nfl_weeks_id_fk" FOREIGN KEY ("nfl_week_id") REFERENCES "public"."nfl_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "polls_week_idx" ON "polls" USING btree ("nfl_week_id");