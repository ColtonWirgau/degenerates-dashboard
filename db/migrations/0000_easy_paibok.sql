CREATE TYPE "public"."charter_approval_rule" AS ENUM('commish', 'majority', 'supermajority', 'unanimous', 'poll');--> statement-breakpoint
CREATE TYPE "public"."charter_category" AS ENUM('logistics', 'rules', 'punishment', 'format', 'custom', 'stakes', 'keepers', 'trading', 'playoffs');--> statement-breakpoint
CREATE TYPE "public"."charter_source" AS ENUM('manual', 'derived-from-poll');--> statement-breakpoint
CREATE TYPE "public"."charter_status" AS ENUM('draft', 'pending', 'locked');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'in-progress', 'final', 'postponed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."graded_by" AS ENUM('manual', 'auto', 'ai');--> statement-breakpoint
CREATE TYPE "public"."leg_result" AS ENUM('win', 'loss', 'push');--> statement-breakpoint
CREATE TYPE "public"."poll_kind" AS ENUM('single', 'ranked');--> statement-breakpoint
CREATE TYPE "public"."poll_option_policy" AS ENUM('closed', 'open', 'curated');--> statement-breakpoint
CREATE TYPE "public"."poll_option_status" AS ENUM('approved', 'pending');--> statement-breakpoint
CREATE TYPE "public"."poll_status" AS ENUM('draft', 'open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."poll_topic" AS ENUM('punishment', 'payout', 'rules', 'season', 'fun', 'logistics');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('approved', 'conflicting');--> statement-breakpoint
CREATE TYPE "public"."week_kind" AS ENUM('regular', 'wildcard', 'divisional', 'conference', 'super-bowl');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "charter_approvals" (
	"entry_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"approved" boolean NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charter_approvals_entry_id_user_id_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "charter_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"season" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"category" charter_category NOT NULL,
	"value" text,
	"description" text,
	"source" charter_source DEFAULT 'manual' NOT NULL,
	"poll_id" uuid,
	"approval_rule" charter_approval_rule NOT NULL,
	"threshold" real,
	"status" charter_status DEFAULT 'draft' NOT NULL,
	"pending_value" text,
	"proposed_by" text,
	"proposed_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "league_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"league_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"sleeper_user_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_members_league_id_user_id_pk" PRIMARY KEY("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "league_weeks" (
	"league_id" uuid NOT NULL,
	"nfl_week_id" uuid NOT NULL,
	"lock_at_cached" timestamp with time zone,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_weeks_league_id_nfl_week_id_pk" PRIMARY KEY("league_id","nfl_week_id")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"created_by" text,
	"slate_days_included" text[] DEFAULT '{"sun","mon"}' NOT NULL,
	"slate_include_holidays" boolean DEFAULT true NOT NULL,
	"lock_offset_minutes" integer DEFAULT 10 NOT NULL,
	"sleeper_league_id" text,
	"sleeper_history_chain" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "nfl_games" (
	"id" text PRIMARY KEY NOT NULL,
	"nfl_week_id" uuid NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_team_name" text NOT NULL,
	"away_team_name" text NOT NULL,
	"kickoff" timestamp with time zone NOT NULL,
	"scheduled_day" text NOT NULL,
	"is_holiday_game" boolean DEFAULT false NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"status" "game_status" DEFAULT 'scheduled' NOT NULL,
	"network" text,
	"venue" text,
	"final_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nfl_teams" (
	"abbr" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"city" text NOT NULL,
	"conference" text NOT NULL,
	"division" text NOT NULL,
	"primary_color" text,
	"secondary_color" text,
	"logo_url" text
);
--> statement-breakpoint
CREATE TABLE "nfl_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" text NOT NULL,
	"week_number" integer NOT NULL,
	"kind" "week_kind" DEFAULT 'regular' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parlay_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parlay_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"leg_number" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"odds" integer NOT NULL,
	"result" "leg_result",
	"validation_status" "validation_status",
	"validation_message" text,
	"locked_at" timestamp with time zone,
	"graded_at" timestamp with time zone,
	"graded_by" "graded_by",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parlays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"nfl_week_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_option_reactions" (
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"value" integer NOT NULL,
	"reacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_option_reactions_poll_id_option_id_user_id_pk" PRIMARY KEY("poll_id","option_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"hint" text,
	"status" "poll_option_status" DEFAULT 'approved' NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_responses" (
	"poll_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"selections" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_responses_poll_id_user_id_pk" PRIMARY KEY("poll_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"kind" "poll_kind" NOT NULL,
	"status" "poll_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"topic" "poll_topic" NOT NULL,
	"option_policy" "poll_option_policy" DEFAULT 'closed' NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"max_ranks" integer,
	"parent_poll_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closes_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"sleeper_user_id" text,
	"sleeper_username" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_approvals" ADD CONSTRAINT "charter_approvals_entry_id_charter_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."charter_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_approvals" ADD CONSTRAINT "charter_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_entries" ADD CONSTRAINT "charter_entries_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_entries" ADD CONSTRAINT "charter_entries_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_entries" ADD CONSTRAINT "charter_entries_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_invitations" ADD CONSTRAINT "league_invitations_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_invitations" ADD CONSTRAINT "league_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_weeks" ADD CONSTRAINT "league_weeks_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_weeks" ADD CONSTRAINT "league_weeks_nfl_week_id_nfl_weeks_id_fk" FOREIGN KEY ("nfl_week_id") REFERENCES "public"."nfl_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfl_games" ADD CONSTRAINT "nfl_games_nfl_week_id_nfl_weeks_id_fk" FOREIGN KEY ("nfl_week_id") REFERENCES "public"."nfl_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parlay_legs" ADD CONSTRAINT "parlay_legs_parlay_id_parlays_id_fk" FOREIGN KEY ("parlay_id") REFERENCES "public"."parlays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parlay_legs" ADD CONSTRAINT "parlay_legs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parlays" ADD CONSTRAINT "parlays_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parlays" ADD CONSTRAINT "parlays_nfl_week_id_nfl_weeks_id_fk" FOREIGN KEY ("nfl_week_id") REFERENCES "public"."nfl_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option_reactions" ADD CONSTRAINT "poll_option_reactions_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option_reactions" ADD CONSTRAINT "poll_option_reactions_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option_reactions" ADD CONSTRAINT "poll_option_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_parent_poll_id_polls_id_fk" FOREIGN KEY ("parent_poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "charter_entries_league_season_key_unique" ON "charter_entries" USING btree ("league_id","season","key");--> statement-breakpoint
CREATE INDEX "league_invitations_email_idx" ON "league_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "nfl_games_week_idx" ON "nfl_games" USING btree ("nfl_week_id");--> statement-breakpoint
CREATE INDEX "nfl_games_kickoff_idx" ON "nfl_games" USING btree ("kickoff");--> statement-breakpoint
CREATE UNIQUE INDEX "nfl_weeks_season_week_unique" ON "nfl_weeks" USING btree ("season","week_number");--> statement-breakpoint
CREATE UNIQUE INDEX "parlay_legs_parlay_user_unique" ON "parlay_legs" USING btree ("parlay_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parlays_league_week_unique" ON "parlays" USING btree ("league_id","nfl_week_id");--> statement-breakpoint
CREATE INDEX "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "polls_league_status_idx" ON "polls" USING btree ("league_id","status");