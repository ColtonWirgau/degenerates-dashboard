-- ============================================================================
-- Migration: cleanup legacy schema, prepare for lock-on-submit lifecycle
-- Date: 2026-05-07
--
-- What this does:
--   1. Archives the deprecated `weeks` table by renaming (data preserved).
--   2. Drops verified-dead columns on `parlays` and `parlay_legs`.
--      Verification (run against live DB on 2026-05-07):
--        - parlays.combined_odds  → 0 / 53 non-null
--        - parlays.week_id        → 23 / 53 non-null, ALWAYS redundant with
--                                    global_week_id (same week_number+season)
--        - parlays.result         → 0 / 53 non-null (per-leg result is source
--                                    of truth, parlay-level result was never set)
--        - parlays.payout_amount  → unused in code
--        - parlay_legs.week_id           → legacy
--        - parlay_legs.included_in_parlay → 241 / 241 = false (dead column)
--        - parlay_legs.status            → 241 / 241 = 'pending' (dead column)
--        - parlay_legs.submitted_at      → identical to created_at on every row
--   3. Drops the `parlays_with_weeks` view (referenced dropped columns; unused
--      in app code).
--   4. Adds `parlay_legs.locked_at` for the new per-leg lifecycle (each user's
--      leg locks the moment they submit; no more global lock/close buttons).
--   5. Adds a unique constraint enforcing one leg per (parlay_id, user_id)
--      — the data already satisfies this; making it explicit.
--   6. KEEPS for now (will be addressed in a follow-up migration once the
--      app code stops touching them):
--        - parlays.deadline      (deadline machinery still in app code)
--        - parlays.status        (lock/close buttons still in app code)
--        - parlay_legs.validation_status / validation_message
--          (AI validation will be re-enabled — keep)
--
-- Safety: all drops are IF EXISTS. The weeks table is renamed, not dropped.
--   To revert: DROP COLUMN can't be undone, but parlays/parlay_legs row data
--   is preserved (the dropped columns held no useful state).
-- ============================================================================

-- Pre-flight counts ---------------------------------------------------------
DO $$
DECLARE
  weeks_n INT;
  parlays_n INT;
  legs_n INT;
BEGIN
  SELECT COUNT(*) INTO weeks_n FROM weeks;
  SELECT COUNT(*) INTO parlays_n FROM parlays;
  SELECT COUNT(*) INTO legs_n FROM parlay_legs;
  RAISE NOTICE 'Pre-migration counts: weeks=%, parlays=%, parlay_legs=%',
    weeks_n, parlays_n, legs_n;
END $$;

-- 1. Archive deprecated weeks table -----------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'weeks'
  ) THEN
    ALTER TABLE weeks RENAME TO _archive_weeks_pre_20260507;
    EXECUTE $cmt$
      COMMENT ON TABLE _archive_weeks_pre_20260507 IS
        'Archived 2026-05-07. Replaced by global_weeks + parlays. Safe to drop after a full season of stable operation under the new model.';
    $cmt$;
  END IF;
END $$;

-- 2. Drop the helper view that referenced now-dead columns ------------------
DROP VIEW IF EXISTS parlays_with_weeks;

-- 3. Drop verified-dead columns on parlays ----------------------------------
ALTER TABLE parlays DROP COLUMN IF EXISTS week_id;
ALTER TABLE parlays DROP COLUMN IF EXISTS combined_odds;
ALTER TABLE parlays DROP COLUMN IF EXISTS result;
ALTER TABLE parlays DROP COLUMN IF EXISTS payout_amount;

-- 4. Drop verified-dead columns on parlay_legs ------------------------------
ALTER TABLE parlay_legs DROP COLUMN IF EXISTS week_id;
ALTER TABLE parlay_legs DROP COLUMN IF EXISTS included_in_parlay;
ALTER TABLE parlay_legs DROP COLUMN IF EXISTS status;
ALTER TABLE parlay_legs DROP COLUMN IF EXISTS submitted_at;

-- 5. Add lock-on-submit lifecycle column ------------------------------------
ALTER TABLE parlay_legs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
COMMENT ON COLUMN parlay_legs.locked_at IS
  'When the user submitted (locked) this leg. NULL = draft, editable. Once set, the leg is immutable.';

-- Backfill: every existing leg was submitted; treat created_at as locked_at
UPDATE parlay_legs SET locked_at = created_at WHERE locked_at IS NULL;

-- 6. Enforce the per-user-per-parlay invariant ------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'parlay_legs' AND indexname = 'unique_user_per_parlay'
  ) THEN
    CREATE UNIQUE INDEX unique_user_per_parlay
      ON parlay_legs (parlay_id, user_id);
  END IF;
END $$;

-- 7. Refresh table-level comments to document the cleaned model -------------
COMMENT ON TABLE parlays IS
  'One parlay per (league, global_week). Each league member contributes one leg via parlay_legs. The parlay wins iff every leg wins.';
COMMENT ON TABLE parlay_legs IS
  'A user''s leg in their league''s weekly parlay. UNIQUE(parlay_id, user_id) — one leg per user per week. locked_at gates editability.';

-- Notify PostgREST to reload its schema cache so the REST API sees the changes
NOTIFY pgrst, 'reload schema';

-- Post-flight counts --------------------------------------------------------
DO $$
DECLARE
  parlays_n INT;
  legs_n INT;
  legs_locked INT;
BEGIN
  SELECT COUNT(*) INTO parlays_n FROM parlays;
  SELECT COUNT(*) INTO legs_n FROM parlay_legs;
  SELECT COUNT(*) INTO legs_locked FROM parlay_legs WHERE locked_at IS NOT NULL;
  RAISE NOTICE 'Post-migration: parlays=%, parlay_legs=%, locked_at backfilled=%',
    parlays_n, legs_n, legs_locked;
END $$;
