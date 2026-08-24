/**
 * Stamp `locked_at` on legs that never got one.
 *
 * Legs imported from the league's history predate this app, so they came
 * in with no lock time — which made every past week read as "still taking
 * submissions" forever. A graded leg was obviously submitted; the best
 * evidence of when is the row's own creation time.
 *
 * Idempotent: only touches rows where locked_at is null and a result is in.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-leg-locks.ts
 */

import { and, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { parlayLegs } from '@/db/schema'

async function main() {
  const result = await db
    .update(parlayLegs)
    .set({ lockedAt: sql`${parlayLegs.createdAt}` })
    .where(and(isNull(parlayLegs.lockedAt), isNotNull(parlayLegs.result)))
    .returning({ id: parlayLegs.id })

  console.log(`Stamped ${result.length} graded leg(s) as locked.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
