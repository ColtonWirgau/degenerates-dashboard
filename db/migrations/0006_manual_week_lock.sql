-- Locking a week becomes a person's act, not a clock's.
--
-- The old model derived a deadline from the schedule (earliest in-slate
-- kickoff minus an offset) and closed the week when it passed. That
-- modelled the wrong event: a week actually closes when whoever places
-- the league's bet says "no more entries, I'm putting the ticket in".
-- That moment can't be derived, so it gets stamped.

ALTER TABLE "league_weeks" RENAME COLUMN "locked_manually_at" TO "locked_at";--> statement-breakpoint

-- Backfill history. Every week whose derived deadline has already passed
-- did close, and the derived deadline is the best record we have of
-- when — same reasoning as the leg lock backfill. Weeks still ahead of
-- that deadline stay null: open until somebody closes them.
UPDATE "league_weeks"
   SET "locked_at" = "lock_at_cached"
 WHERE "locked_at" IS NULL
   AND "lock_at_cached" IS NOT NULL
   AND "lock_at_cached" <= now();
