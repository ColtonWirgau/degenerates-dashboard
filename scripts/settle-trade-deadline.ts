// The trade deadline is week 10.
//
// It was the last unsettled item in TRADING, sitting on "Awaiting" with
// an approval rule of supermajority and nothing to approve. There was
// never a vote to hold: the league runs it the same way every year and
// Colton said so directly. So it's written down rather than balloted.
//
// Its own description already said the Sleeper default is end of week
// 11 and that we were proposing to keep that — we don't; it's 10.
//
// Idempotent. `--dry-run` prints the write without making it.

import './load-env'
import { db } from '@/db/client'
import { charterEntries } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const SEASON = '2026-2027'
const VALUE = 'Week 10'
const DESCRIPTION =
  'No trades after the week 10 deadline, so the playoff race stays clean.'

async function main() {
  const dry = process.argv.includes('--dry-run')

  const [entry] = await db
    .select()
    .from(charterEntries)
    .where(
      and(
        eq(charterEntries.leagueId, LEAGUE),
        eq(charterEntries.season, SEASON),
        eq(charterEntries.key, 'trade-deadline')
      )
    )
    .limit(1)

  if (!entry) {
    console.log(`✗ no trade-deadline entry for ${SEASON}`)
    process.exit(1)
  }
  if (entry.status === 'locked' && entry.value === VALUE) {
    console.log(`· already settled as "${entry.value}"`)
    process.exit(0)
  }

  console.log(
    `${dry ? '[dry] ' : ''}→ trade-deadline: ${entry.status}/${JSON.stringify(entry.value)} → locked/"${VALUE}"`
  )
  if (!dry) {
    await db
      .update(charterEntries)
      .set({
        value: VALUE,
        description: DESCRIPTION,
        status: 'locked',
        lockedAt: new Date(),
        // Nobody voted and nobody needs to — the rule that governs it is
        // the commish writing down what the league already does.
        approvalRule: 'commish',
      })
      .where(eq(charterEntries.id, entry.id))
  }
  process.exit(0)
}

main()
