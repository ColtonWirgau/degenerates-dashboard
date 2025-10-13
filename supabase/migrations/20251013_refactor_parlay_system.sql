-- Refactor parlay system: Create parlay with week, not on lock
-- This migration restructures the database so that every week has exactly one parlay from creation

-- Step 1: Drop existing foreign key constraints that reference parlays.user_id
ALTER TABLE parlay_legs DROP CONSTRAINT IF EXISTS parlay_legs_parlay_id_fkey;

-- Step 2: Make user_id nullable in parlays table (final parlays don't belong to one user)
ALTER TABLE parlays ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Add unique constraint to ensure one parlay per week
DROP INDEX IF EXISTS unique_parlay_per_week;
CREATE UNIQUE INDEX unique_parlay_per_week ON parlays(week_id);

-- Step 4: Re-add foreign key constraint for parlay_legs
ALTER TABLE parlay_legs
  ADD CONSTRAINT parlay_legs_parlay_id_fkey
  FOREIGN KEY (parlay_id)
  REFERENCES parlays(id)
  ON DELETE CASCADE;

-- Step 5: Add helpful comments
COMMENT ON TABLE parlays IS 'One parlay per week, created when week is created. Contains all submitted legs when locked.';
COMMENT ON COLUMN parlays.user_id IS 'DEPRECATED: No longer used. Final parlays are not owned by individual users.';
COMMENT ON COLUMN parlays.week_id IS 'The week this parlay belongs to. Each week has exactly one parlay.';
COMMENT ON COLUMN parlays.total_odds IS 'Combined odds for all legs in the parlay (calculated when locked)';

-- Step 6: Clean up any orphaned data (optional - only if you want to wipe)
-- Uncomment these lines to clean up existing data:
-- DELETE FROM parlay_legs;
-- DELETE FROM parlays;

-- Step 7: Create parlays for existing weeks that don't have one
INSERT INTO parlays (week_id, status, total_odds, user_id)
SELECT
  w.id as week_id,
  'pending' as status,
  NULL as total_odds,
  NULL as user_id
FROM weeks w
WHERE NOT EXISTS (
  SELECT 1 FROM parlays p WHERE p.week_id = w.id
)
ON CONFLICT DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
