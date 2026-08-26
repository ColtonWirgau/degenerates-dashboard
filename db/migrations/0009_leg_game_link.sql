-- Which game a leg is actually on.
--
-- Legs are free text, so until now nothing connected a bet to a game.
-- The slate papered over that by hashing the leg id and scattering real
-- bets across the schedule at random; this is the real link.
--
-- Nullable, permanently: "DK/ASB combined rec yards 150+" is a bet
-- across two games, and a null is the honest answer for it.
ALTER TABLE "parlay_legs" ADD COLUMN IF NOT EXISTS "nfl_game_id" text;

DO $$ BEGIN
  ALTER TABLE "parlay_legs"
    ADD CONSTRAINT "parlay_legs_nfl_game_id_nfl_games_id_fk"
    FOREIGN KEY ("nfl_game_id") REFERENCES "nfl_games"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "parlay_legs_nfl_game_id_idx"
  ON "parlay_legs" ("nfl_game_id");
