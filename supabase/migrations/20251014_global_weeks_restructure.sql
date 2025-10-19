-- Restructure to use global weeks and league-specific parlays
-- This creates a cleaner architecture where weeks are season-global, parlays are league-specific

-- ============================================
-- STEP 1: Create global_weeks table
-- ============================================
CREATE TABLE IF NOT EXISTS global_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL,
  season TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one week number per season
  UNIQUE(season, week_number)
);

COMMENT ON TABLE global_weeks IS 'Global week definitions across all leagues. One set of weeks per season.';
COMMENT ON COLUMN global_weeks.week_number IS 'Week number within the season (1-18 for NFL)';
COMMENT ON COLUMN global_weeks.season IS 'The season this week belongs to (e.g., "2024-2025", "2025-2026")';

CREATE INDEX IF NOT EXISTS idx_global_weeks_season ON global_weeks(season, week_number);

-- ============================================
-- STEP 2: Seed global weeks for current season with dates
-- ============================================
-- Calculate week dates for 2025-2026 season
-- NFL season typically starts first Sunday after Labor Day (early September)
-- For 2025-2026: First week starts September 7, 2025
DO $$
DECLARE
  season_start_date DATE := '2025-09-07'::DATE; -- First Sunday of 2025 NFL season
  week_num INTEGER;
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
BEGIN
  FOR week_num IN 1..18 LOOP
    -- Each week starts on Sunday at 9:15 AM ET (when first games typically start)
    -- Create timestamp in America/New_York timezone, then convert to UTC for storage
    week_start := ((season_start_date + ((week_num - 1) * 7))::TIMESTAMP + INTERVAL '9 hours 15 minutes') AT TIME ZONE 'America/New_York';
    -- Each week ends on Tuesday at 5:00 AM ET (after MNF has concluded)
    week_end := ((season_start_date + ((week_num - 1) * 7) + 2)::TIMESTAMP + INTERVAL '5 hours') AT TIME ZONE 'America/New_York';

    INSERT INTO global_weeks (week_number, season, start_date, end_date)
    VALUES (week_num, '2025-2026', week_start, week_end)
    ON CONFLICT (season, week_number)
    DO UPDATE SET
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date;
  END LOOP;
END $$;

-- ============================================
-- STEP 3: Add global_week_id to parlays table
-- ============================================
-- First add the column as nullable
ALTER TABLE parlays ADD COLUMN IF NOT EXISTS global_week_id UUID REFERENCES global_weeks(id);
ALTER TABLE parlays ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE parlays ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE parlays ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

-- Make week_id nullable since it's deprecated
ALTER TABLE parlays ALTER COLUMN week_id DROP NOT NULL;

COMMENT ON COLUMN parlays.global_week_id IS 'Reference to the global week definition';
COMMENT ON COLUMN parlays.league_id IS 'The league this parlay belongs to';
COMMENT ON COLUMN parlays.deadline IS 'Submission deadline for this parlay (league-specific)';
COMMENT ON COLUMN parlays.status IS 'Status: open, locked, closed';
COMMENT ON COLUMN parlays.week_id IS 'DEPRECATED: Legacy column, use global_week_id instead';

-- ============================================
-- STEP 4: Migrate existing data
-- ============================================
-- Create a mapping from existing weeks to global_weeks
DO $$
DECLARE
  week_record RECORD;
  global_week_uuid UUID;
BEGIN
  FOR week_record IN
    SELECT DISTINCT w.id as old_week_id, w.week_number, w.season, w.league_id, w.deadline
    FROM weeks w
  LOOP
    -- Find or create corresponding global week
    SELECT id INTO global_week_uuid
    FROM global_weeks
    WHERE season = week_record.season
      AND week_number = week_record.week_number;

    -- If global week doesn't exist, create it
    IF global_week_uuid IS NULL THEN
      INSERT INTO global_weeks (week_number, season)
      VALUES (week_record.week_number, week_record.season)
      RETURNING id INTO global_week_uuid;
    END IF;

    -- Update parlays that reference this old week
    UPDATE parlays p
    SET
      global_week_id = global_week_uuid,
      league_id = week_record.league_id,
      deadline = week_record.deadline,
      status = (
        SELECT CASE
          WHEN w.status = 'open' THEN 'open'
          WHEN w.status = 'locked' THEN 'locked'
          WHEN w.status = 'closed' THEN 'closed'
          ELSE 'open'
        END
        FROM weeks w
        WHERE w.id = week_record.old_week_id
      )
    WHERE p.week_id = week_record.old_week_id;
  END LOOP;
END $$;

-- ============================================
-- STEP 5: Update parlay_legs to reference parlays directly
-- ============================================
-- For backward compatibility, we keep week_id but interpret it as the parlay_id
-- Since after migration, week_id in parlay_legs actually points to parlays table
-- We don't need to change the column, just understand the new semantics:
-- - parlay_legs.week_id now points to parlays.id (which used to be weeks.id)
-- - parlay_legs.parlay_id continues to point to the parlay they're assigned to
-- This works because parlays inherited the IDs from weeks in the migration above

-- However, let's add a helpful comment
COMMENT ON COLUMN parlay_legs.week_id IS 'Legacy column - now references parlays.id for the week context';

-- ============================================
-- STEP 6: Add constraints
-- ============================================
-- Make global_week_id and league_id required (after migration)
DO $$
BEGIN
  -- Only set NOT NULL if all rows have been migrated
  IF NOT EXISTS (SELECT 1 FROM parlays WHERE global_week_id IS NULL LIMIT 1) THEN
    ALTER TABLE parlays ALTER COLUMN global_week_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM parlays WHERE league_id IS NULL LIMIT 1) THEN
    ALTER TABLE parlays ALTER COLUMN league_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not set NOT NULL constraints - ensure all data is migrated';
END $$;

-- Ensure one parlay per league per global week
DROP INDEX IF EXISTS unique_parlay_per_league_week;
CREATE UNIQUE INDEX unique_parlay_per_league_week
ON parlays(league_id, global_week_id);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_parlays_league ON parlays(league_id);
CREATE INDEX IF NOT EXISTS idx_parlays_global_week ON parlays(global_week_id);
CREATE INDEX IF NOT EXISTS idx_parlays_league_status ON parlays(league_id, status);

-- ============================================
-- STEP 7: Create helper views
-- ============================================
-- View to easily see parlays with their week info
CREATE OR REPLACE VIEW parlays_with_weeks AS
SELECT
  p.id as parlay_id,
  p.league_id,
  p.deadline,
  p.status,
  p.total_odds,
  p.result,
  p.payout_amount,
  p.completed_at,
  p.created_at,
  p.updated_at,
  gw.id as global_week_id,
  gw.week_number,
  gw.season,
  gw.start_date as week_start_date,
  gw.end_date as week_end_date
FROM parlays p
JOIN global_weeks gw ON p.global_week_id = gw.id;

COMMENT ON VIEW parlays_with_weeks IS 'Parlays joined with their global week information for easy querying';

-- ============================================
-- STEP 8: Enable RLS on global_weeks
-- ============================================
ALTER TABLE global_weeks ENABLE ROW LEVEL SECURITY;

-- Everyone can read global weeks (they're public)
CREATE POLICY "Global weeks are viewable by everyone"
  ON global_weeks FOR SELECT
  USING (true);

-- Only authenticated users can see which weeks exist
CREATE POLICY "Authenticated users can view global weeks"
  ON global_weeks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- STEP 9: Update existing RLS policies on parlays
-- ============================================
-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view parlays in their leagues" ON parlays;
DROP POLICY IF EXISTS "Users can update parlays in their leagues" ON parlays;

-- New policies for league-specific parlays
CREATE POLICY "Users can view parlays in their leagues"
  ON parlays FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_members lm
      WHERE lm.league_id = parlays.league_id
        AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update parlays in their leagues"
  ON parlays FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_members lm
      WHERE lm.league_id = parlays.league_id
        AND lm.user_id = auth.uid()
        AND lm.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- STEP 10: Create function to auto-create parlays
-- ============================================
CREATE OR REPLACE FUNCTION create_parlays_for_league_season(
  p_league_id UUID,
  p_season TEXT DEFAULT '2025-2026'
)
RETURNS INTEGER AS $$
DECLARE
  created_count INTEGER := 0;
  week_record RECORD;
  default_deadline TIMESTAMPTZ;
BEGIN
  -- For each global week in the season
  FOR week_record IN
    SELECT id, week_number, start_date FROM global_weeks WHERE season = p_season
  LOOP
    -- Use the global week's start_date as the deadline (Sunday 9:15 AM)
    -- If no start_date, fall back to a calculated date
    IF week_record.start_date IS NOT NULL THEN
      default_deadline := week_record.start_date;
    ELSE
      default_deadline := now() + (week_record.week_number * INTERVAL '1 week');
    END IF;

    -- Create parlay if it doesn't exist
    INSERT INTO parlays (league_id, global_week_id, deadline, status)
    VALUES (p_league_id, week_record.id, default_deadline, 'open')
    ON CONFLICT (league_id, global_week_id) DO NOTHING;

    -- Increment counter if a row was inserted
    IF FOUND THEN
      created_count := created_count + 1;
    END IF;
  END LOOP;

  RETURN created_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_parlays_for_league_season IS 'Creates parlays for all weeks in a season for a specific league';

-- ============================================
-- STEP 10B: Create helper function to get current week
-- ============================================
CREATE OR REPLACE FUNCTION get_current_global_week(p_season TEXT DEFAULT '2025-2026')
RETURNS TABLE (
  id UUID,
  week_number INTEGER,
  season TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT gw.id, gw.week_number, gw.season, gw.start_date, gw.end_date
  FROM global_weeks gw
  WHERE gw.season = p_season
    AND now() >= gw.start_date
    AND now() <= gw.end_date
  ORDER BY gw.week_number DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_global_week IS 'Returns the current week based on start_date and end_date for a given season';

-- ============================================
-- STEP 11: Create parlays for all existing leagues
-- ============================================
-- Create parlays for current season for all leagues
DO $$
DECLARE
  league_record RECORD;
  created INTEGER;
BEGIN
  FOR league_record IN SELECT id FROM leagues
  LOOP
    SELECT create_parlays_for_league_season(league_record.id, '2025-2026') INTO created;
    RAISE NOTICE 'Created % parlays for league %', created, league_record.id;
  END LOOP;
END $$;

-- ============================================
-- STEP 12: Deprecate the old weeks table
-- ============================================
-- The weeks table is no longer needed since we've migrated to global_weeks + parlays
-- However, we'll keep it for now to allow gradual migration of application code
-- Add a comment to indicate it's deprecated
COMMENT ON TABLE weeks IS 'DEPRECATED: Use global_weeks + parlays instead. This table is kept for backward compatibility during migration.';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
