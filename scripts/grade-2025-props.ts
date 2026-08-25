// The eleven legs of 2025-2026 that were never marked. All player props,
// so none of them could be settled from a final score — each one needed
// the actual box score, pulled from ESPN's summary endpoint for the exact
// game (nfl_games.id IS the ESPN event id).
//
// The stat line behind every call is in the comment beside it, so this is
// checkable rather than trusted. `--dry-run` prints without writing.

import './load-env'
import { db } from '@/db/client'
import { nflWeeks, parlayLegs, parlays } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const SEASON = '2025-2026'

const CALLS: Array<{
  week: number
  match: string
  result: 'win' | 'loss'
  evidence: string
}> = [
  {
    week: 11,
    match: 'Dak 240+',
    result: 'win',
    evidence: 'DAL@LV — Prescott 25/33, 268 yds, 4 TD. 268 ≥ 240.',
  },
  {
    week: 13,
    match: 'Achane +25 rec yards',
    result: 'loss',
    evidence: 'NO@MIA — Achane 0 rec, 0 yds on 1 target. Nowhere near 25.',
  },
  {
    week: 13,
    match: 'Davante Adams ATTD',
    result: 'win',
    evidence: 'LAR@CAR — Adams 4 rec, 58 yds, 2 TD.',
  },
  {
    week: 13,
    match: 'Travis etienne longest rush',
    result: 'loss',
    evidence: 'JAX@TEN — Etienne 12 car, 28 yds, long of 6. Under 13.5.',
  },
  {
    week: 16,
    match: 'Bijan ATTD',
    result: 'win',
    evidence:
      'ATL@ARI — Bijan 0 rush TD but 7 rec, 92 yds, 1 receiving TD. Anytime is anytime.',
  },
  {
    week: 16,
    match: 'Goedert 4+ rec',
    result: 'loss',
    evidence: 'PHI@WSH — Goedert 3 rec on 3 targets (and a TD). One short.',
  },
  {
    week: 16,
    match: 'JaMarr Chase ATD',
    result: 'loss',
    evidence:
      "CIN@MIA — Ja'Marr Chase 9 rec, 109 yds, 0 TD. Chase BROWN scored three in the same game.",
  },
  {
    week: 16,
    match: 'DK/ASB combined rec yards 150+',
    result: 'loss',
    evidence: 'PIT@DET — Metcalf 42, St. Brown 54. 96 combined, needed 150.',
  },
  {
    week: 16,
    match: 'Saquon ATTD',
    result: 'win',
    evidence: 'PHI@WSH — Barkley 21 car, 132 yds, 1 rush TD.',
  },
  {
    week: 16,
    match: 'Jordan love 1 int',
    result: 'loss',
    evidence: 'GB@CHI — Love 8/13, 77 yds, 0 INT.',
  },
  {
    week: 16,
    match: 'Deandre swift 70+ rush and receiving',
    result: 'win',
    // The one genuinely close call in the set. Read as combined
    // scrimmage yards — which is what "rush and receiving" means on a
    // ticket — he landed on the number exactly, and a "70+" prop is a
    // yes/no market with no push: 70 clears 70.
    evidence: 'GB@CHI — Swift 58 rush + 12 rec = 70 exactly. 70+ includes 70.',
  },
]

async function main() {
  const dry = process.argv.includes('--dry-run')

  const legs = await db
    .select({
      id: parlayLegs.id,
      week: nflWeeks.weekNumber,
      description: parlayLegs.description,
      result: parlayLegs.result,
    })
    .from(parlays)
    .innerJoin(nflWeeks, eq(parlays.nflWeekId, nflWeeks.id))
    .innerJoin(parlayLegs, eq(parlayLegs.parlayId, parlays.id))
    .where(and(eq(parlays.leagueId, LEAGUE), eq(nflWeeks.season, SEASON)))

  let done = 0
  for (const call of CALLS) {
    const hits = legs.filter(
      (l) =>
        l.week === call.week &&
        l.description.toLowerCase().includes(call.match.toLowerCase())
    )
    if (hits.length !== 1) {
      console.log(`✗ wk${call.week} "${call.match}" matched ${hits.length} legs — skipped`)
      continue
    }
    const leg = hits[0]!
    if (leg.result !== null) {
      console.log(`· wk${call.week} ${leg.description} — already ${leg.result}`)
      continue
    }
    console.log(
      `${dry ? '[dry] ' : ''}→ wk${call.week} ${leg.description}\n        ${call.result.toUpperCase()} — ${call.evidence}`
    )
    if (dry) continue
    await db
      .update(parlayLegs)
      .set({ result: call.result })
      .where(eq(parlayLegs.id, leg.id))
    done++
  }
  console.log(`\n${dry ? 'would grade' : 'graded'} ${dry ? CALLS.length : done} legs`)
  process.exit(0)
}

main()
