CREATE TABLE "league_keepers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"season" text NOT NULL,
	"user_id" text NOT NULL,
	"player_name" text NOT NULL,
	"position" text,
	"round_cost" integer,
	"year_of_keep" integer DEFAULT 1 NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_keepers" ADD CONSTRAINT "league_keepers_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_keepers" ADD CONSTRAINT "league_keepers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "league_keepers_unique" ON "league_keepers" USING btree ("league_id","season","user_id",lower("player_name"));--> statement-breakpoint
CREATE INDEX "league_keepers_league_season_idx" ON "league_keepers" USING btree ("league_id","season");