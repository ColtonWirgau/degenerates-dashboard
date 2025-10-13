-- Consolidate multiple season-based leagues into one league with seasons on weeks
-- This migration moves the season information from leagues to weeks

-- Step 1: Add season column to weeks table
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS season TEXT NOT NULL DEFAULT '2025-2026';

-- Step 2: Migrate existing season data from leagues to weeks
UPDATE weeks w
SET season = l.season
FROM leagues l
WHERE w.league_id = l.id
  AND l.season IS NOT NULL;

-- Step 3: Update all weeks to point to the primary league (2025-2026 season league)
-- First, get the ID of the primary league
DO $$
DECLARE
  primary_league_id UUID;
BEGIN
  -- Find the 2025-2026 season league as the primary league
  SELECT id INTO primary_league_id
  FROM leagues
  WHERE season = '2025-2026'
  LIMIT 1;

  -- Update all weeks to use this league ID
  IF primary_league_id IS NOT NULL THEN
    UPDATE weeks
    SET league_id = primary_league_id;
  END IF;
END $$;

-- Step 4: Update league_members to consolidate to primary league
DO $$
DECLARE
  primary_league_id UUID;
BEGIN
  SELECT id INTO primary_league_id
  FROM leagues
  WHERE season = '2025-2026'
  LIMIT 1;

  IF primary_league_id IS NOT NULL THEN
    -- Insert members from other leagues if they don't already exist
    INSERT INTO league_members (league_id, user_id, role)
    SELECT DISTINCT primary_league_id, user_id, role
    FROM league_members
    WHERE league_id != primary_league_id
    ON CONFLICT (league_id, user_id) DO NOTHING;

    -- Delete old league member entries
    DELETE FROM league_members
    WHERE league_id != primary_league_id;
  END IF;
END $$;

-- Step 5: Delete old leagues (keep only the primary one)
DELETE FROM leagues
WHERE season != '2025-2026';

-- Step 6: Remove season column from leagues (it's now on weeks)
ALTER TABLE leagues DROP COLUMN IF EXISTS season;

-- Step 7: Add index for faster season-based queries
CREATE INDEX IF NOT EXISTS idx_weeks_league_season ON weeks(league_id, season);

-- Step 8: Add helpful comments
COMMENT ON COLUMN weeks.season IS 'The season this week belongs to (e.g., "2024-2025", "2025-2026")';
COMMENT ON TABLE leagues IS 'Betting leagues. Each league can have multiple seasons tracked via weeks.season column.';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
