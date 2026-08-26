-- Legs whose RESULT is real but whose text never existed.
--
-- The league scored two seasons in a shared Apple Note before this app.
-- The note holds only the current week's table, so when that history was
-- imported the wins and losses came across exactly and the leg wording
-- did not — it was filled with placeholder samples. Those rows read as
-- real bets (Vikings -5, seven weeks running, one of them on a bye).
ALTER TABLE "parlay_legs"
  ADD COLUMN IF NOT EXISTS "record_only" boolean NOT NULL DEFAULT false;

-- The import: three bulk inserts on the day the app took over.
UPDATE "parlay_legs"
   SET "record_only" = true,
       "description"  = 'Unknown leg',
       "nfl_game_id"  = NULL
 WHERE "created_at" >= '2025-10-13T16:00:00Z'
   AND "created_at" <  '2025-10-13T18:00:00Z';

CREATE INDEX IF NOT EXISTS "parlay_legs_record_only_idx"
  ON "parlay_legs" ("record_only");
