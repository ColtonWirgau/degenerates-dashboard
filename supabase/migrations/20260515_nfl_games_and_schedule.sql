-- ============================================
-- NFL Games + Schedule
-- ============================================
-- Adds the canonical NFL game table (one row per matchup, refs global_weeks)
-- so we can wire the schedule into parlay deadlines, leg validation, and
-- (eventually) auto-grading from upstream scores.
--
-- Also extends global_weeks with a `kind` column so playoff weeks
-- (wildcard / divisional / conference / super-bowl) live alongside the
-- regular 18 — same shape the draft schema in db/schema.draft.ts uses.

-- Add `kind` column to global_weeks for playoff week classification.
-- Default 'regular' so existing 1-18 rows stay valid without backfill.
ALTER TABLE global_weeks
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'regular'
  CHECK (kind IN ('regular', 'wildcard', 'divisional', 'conference', 'super-bowl'));

COMMENT ON COLUMN global_weeks.kind IS 'Week type: regular (1-18), wildcard (19), divisional (20), conference (21), super-bowl (22)';

-- ============================================
-- nfl_games — one row per scheduled matchup
-- ============================================
CREATE TABLE IF NOT EXISTS nfl_games (
  -- Upstream provider id (ESPN event id) so re-runs of the loader
  -- upsert cleanly without dupes.
  id TEXT PRIMARY KEY,
  global_week_id UUID NOT NULL REFERENCES global_weeks(id) ON DELETE CASCADE,

  -- Team identifiers: abbreviation (3 chars, e.g. 'DAL') as the canonical
  -- key, full name for display ("Dallas Cowboys"). We keep them denormalized
  -- on the game row instead of a separate teams table — 32 teams * leg-
  -- description matching doesn't need joins.
  home_team TEXT NOT NULL, -- e.g. 'DAL'
  away_team TEXT NOT NULL, -- e.g. 'PHI'
  home_team_name TEXT NOT NULL, -- e.g. 'Dallas Cowboys'
  away_team_name TEXT NOT NULL,

  kickoff TIMESTAMPTZ NOT NULL,
  -- Live state from upstream. Null scores until kickoff.
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in-progress', 'final', 'postponed', 'canceled')),
  -- Broadcast + venue metadata (nice-to-have for the slate UI).
  network TEXT,
  venue TEXT,
  final_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE nfl_games IS 'NFL game schedule + live state. Populated by scripts/load-nfl-schedule.ts.';
COMMENT ON COLUMN nfl_games.id IS 'Upstream ESPN event id — stable across re-fetches.';

CREATE INDEX IF NOT EXISTS idx_nfl_games_week ON nfl_games(global_week_id);
CREATE INDEX IF NOT EXISTS idx_nfl_games_kickoff ON nfl_games(kickoff);
-- Partial index for the auto-grading pass — only games still in motion need polling.
CREATE INDEX IF NOT EXISTS idx_nfl_games_active ON nfl_games(status) WHERE status != 'final';

-- ============================================
-- updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION nfl_games_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nfl_games_touch_updated_at ON nfl_games;
CREATE TRIGGER nfl_games_touch_updated_at
  BEFORE UPDATE ON nfl_games
  FOR EACH ROW
  EXECUTE FUNCTION nfl_games_touch_updated_at();

-- ============================================
-- RLS — schedule is public
-- ============================================
ALTER TABLE nfl_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "NFL games are viewable by everyone" ON nfl_games;
CREATE POLICY "NFL games are viewable by everyone"
  ON nfl_games FOR SELECT
  USING (true);

-- Reload PostgREST schema cache so the new table shows up immediately
NOTIFY pgrst, 'reload schema';
