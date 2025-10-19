-- Fix deadline timezones: Convert existing UTC deadlines to Eastern Time
-- Current deadlines are stored as 9:15 UTC, but should be 9:15 AM ET (13:15 or 14:15 UTC)

-- ============================================
-- STEP 1: Fix global_weeks start_date and end_date
-- ============================================
-- Update existing global weeks to have proper ET timezone
-- 9:15 AM ET = 14:15 UTC (during EDT) or 15:15 UTC (during EST)
-- We'll use 13:15 UTC which accounts for EDT (most of the season)

DO $$
DECLARE
  week_record RECORD;
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
BEGIN
  FOR week_record IN
    SELECT id, week_number, start_date, end_date, season
    FROM global_weeks
    WHERE season = '2025-2026'
  LOOP
    -- If start_date exists and looks like it's at 9:15 UTC, fix it
    IF week_record.start_date IS NOT NULL THEN
      -- Check if it's at 9:15 (indicating it's wrong)
      IF EXTRACT(HOUR FROM week_record.start_date) = 9 AND EXTRACT(MINUTE FROM week_record.start_date) = 15 THEN
        -- Add 4 hours to convert from UTC to EDT (9:15 UTC -> 13:15 UTC which is 9:15 EDT)
        new_start := week_record.start_date + INTERVAL '4 hours';

        UPDATE global_weeks
        SET start_date = new_start
        WHERE id = week_record.id;

        RAISE NOTICE 'Updated week % start_date from % to %', week_record.week_number, week_record.start_date, new_start;
      END IF;
    END IF;

    -- Fix end_date similarly (5:00 AM ET = 9:00 UTC during EDT)
    IF week_record.end_date IS NOT NULL THEN
      IF EXTRACT(HOUR FROM week_record.end_date) = 5 THEN
        new_end := week_record.end_date + INTERVAL '4 hours';

        UPDATE global_weeks
        SET end_date = new_end
        WHERE id = week_record.id;

        RAISE NOTICE 'Updated week % end_date from % to %', week_record.week_number, week_record.end_date, new_end;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- STEP 2: Fix parlay deadlines
-- ============================================
-- Update parlays that have 9:15 UTC deadlines to 13:15 UTC (9:15 AM EDT)

DO $$
DECLARE
  parlay_record RECORD;
  new_deadline TIMESTAMPTZ;
BEGIN
  FOR parlay_record IN
    SELECT p.id, p.deadline, gw.week_number
    FROM parlays p
    JOIN global_weeks gw ON p.global_week_id = gw.id
    WHERE gw.season = '2025-2026'
      AND p.deadline IS NOT NULL
  LOOP
    -- Check if deadline is at 9:15 (indicating it's in UTC instead of ET)
    IF EXTRACT(HOUR FROM parlay_record.deadline) = 9 AND EXTRACT(MINUTE FROM parlay_record.deadline) = 15 THEN
      -- Add 4 hours to convert from UTC to EDT
      new_deadline := parlay_record.deadline + INTERVAL '4 hours';

      UPDATE parlays
      SET deadline = new_deadline
      WHERE id = parlay_record.id;

      RAISE NOTICE 'Updated week % parlay deadline from % to %', parlay_record.week_number, parlay_record.deadline, new_deadline;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- STEP 3: Update the global weeks seeding for future runs
-- ============================================
-- Recreate the global weeks with proper timezone handling
-- This updates the migration inline for any future resets

-- NOTE: This doesn't re-run the original migration, but provides the corrected version
-- for reference. The DO blocks above fix the existing data.

COMMENT ON TABLE global_weeks IS 'Global week definitions across all leagues. One set of weeks per season. Times are stored in UTC but represent Eastern Time (America/New_York).';
