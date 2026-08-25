CREATE TABLE "nfl_players" (
	"sleeper_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"search_name" text NOT NULL,
	"position" text NOT NULL,
	"team" text,
	"number" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_keepers" ADD COLUMN "sleeper_id" text;--> statement-breakpoint
CREATE INDEX "nfl_players_search_idx" ON "nfl_players" USING btree ("search_name");--> statement-breakpoint
CREATE INDEX "nfl_players_position_idx" ON "nfl_players" USING btree ("position");