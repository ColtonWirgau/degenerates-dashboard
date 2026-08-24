/**
 * Stamp `locked_at` on legs that never got one.
 *
 * Legs imported from the league's history predate this app, so they came
 * in with no lock time — and a leg with no lock time reads as a DRAFT,
 * which made every past week say "still taking submissions" forever.
 * None of them are drafts: they're finished business, graded or not. The
 * best evidence of when each went in is the row's own creation time, so
 * that's the guess we stamp.
 *
 * Safe to run again, and safe to leave in place: every leg submitted
 * through the app gets its lock stamp at write time (see the adapter's
 * submitLeg), so the only rows this can ever find are imported ones.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-leg-locks.ts
 */

import { isNull, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { parlayLegs } from '@/db/schema'

async function main() {
  const result = await db
    .update(parlayLegs)
    .set({ lockedAt: sql`${parlayLegs.createdAt}` })
    .where(isNull(parlayLegs.lockedAt))
    .returning({ id: parlayLegs.id, result: parlayLegs.result })

  const graded = result.filter((r) => r.result !== null).length
  console.log(
    `Stamped ${result.length} leg(s) as locked — ${graded} graded, ${
      result.length - graded
    } still awaiting a result.`
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
