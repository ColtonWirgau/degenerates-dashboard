/**
 * Close out the weeks that already happened.
 *
 * The league's history was imported, not played through the app, so the
 * rows that the app *derives* were never written. Three holes, all of
 * them fillable from data we already have:
 *
 *   1. LOCK STAMPS. `league_weeks.locked_at` is the moment somebody
 *      closed the week to new entries. Nobody was there to close the
 *      imported ones, so they all read as still open. The best stand-in
 *      is the moment the first game the league bets kicked off — by then
 *      the ticket was certainly down.
 *
 *   2. GRADING STAMPS. Legs that carry a result but no `graded_at` /
 *      `graded_by`. They were graded by a human, off-app; say so, and
 *      date it to the week's own rollover, which is the earliest moment
 *      every result was knowable.
 *
 *   3. RESULTS, where the score settles it. Legs are free text with no
 *      game FK, so this only grades bets the final score can answer —
 *      spreads and moneylines, matched to exactly one game in the leg's
 *      own week. Player props (`Bijan ATTD`, `Achane +25 rec yards`) need
 *      box-score data this database doesn't hold, and guessing at them
 *      would be inventing a record, not seeding one. Those are listed at
 *      the end for a human to settle.
 *
 * Idempotent — every step is "fill what's missing", so re-running after
 * loading another season picks up only the new rows. Nothing here
 * overwrites a result that already exists.
 *
 *   npx tsx --env-file=.env.local scripts/close-out-past-weeks.ts
 *   npx tsx --env-file=.env.local scripts/close-out-past-weeks.ts --dry-run
 */

import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  leagues,
  leagueWeeks,
  nflGames,
  nflTeams,
  nflWeeks,
  parlayLegs,
  parlays,
} from '@/db/schema'
import { firstSlateKickoff, getWeekLock, setWeekLocked } from '@/lib/lock-time'

const DRY = process.argv.includes('--dry-run')

// ─── 1. Lock stamps ────────────────────────────────────────────────────────

/**
 * Close every week that already happened.
 *
 * Only ever fills blanks — a week somebody actually closed keeps the
 * moment they closed it, and a week still ahead of its first kickoff is
 * left open, because it genuinely is.
 */
async function stampLocks(leagueId: string) {
  const weeks = await db
    .select({
      id: nflWeeks.id,
      season: nflWeeks.season,
      weekNumber: nflWeeks.weekNumber,
    })
    .from(nflWeeks)
    .where(inArray(nflWeeks.kind, ['preseason', 'regular']))
    .orderBy(asc(nflWeeks.season), asc(nflWeeks.weekNumber))

  const now = new Date()
  let written = 0
  let skipped = 0
  for (const week of weeks) {
    if (await getWeekLock(leagueId, week.id)) {
      skipped++ // already closed, by a person or a previous run
      continue
    }
    const kickoff = await firstSlateKickoff(leagueId, week.id)
    // Preseason has no games; a future week hasn't happened yet. Neither
    // is a week anybody failed to close.
    if (kickoff === null || kickoff > now) {
      skipped++
      continue
    }
    if (!DRY) await setWeekLocked(leagueId, week.id, true, kickoff)
    written++
  }
  console.log(`  locks: ${written} past week(s) closed, ${skipped} left alone`)
}

// ─── 2. Grading stamps ─────────────────────────────────────────────────────

/** A result with no `graded_at` is a result with no provenance. Date it to
 *  the week's rollover — the first moment every game in it was final. */
async function stampGrading() {
  const rows = await db
    .select({
      id: parlayLegs.id,
      weekEnd: nflWeeks.endDate,
      weekStart: nflWeeks.startDate,
    })
    .from(parlayLegs)
    .innerJoin(parlays, eq(parlays.id, parlayLegs.parlayId))
    .innerJoin(nflWeeks, eq(nflWeeks.id, parlays.nflWeekId))
    .where(and(isNotNull(parlayLegs.result), isNull(parlayLegs.gradedAt)))

  for (const row of rows) {
    const at =
      row.weekEnd ??
      (row.weekStart ? new Date(row.weekStart.getTime() + 3 * 86_400_000) : new Date())
    if (!DRY) {
      await db
        .update(parlayLegs)
        .set({ gradedAt: at, gradedBy: 'manual' })
        .where(eq(parlayLegs.id, row.id))
    }
  }
  console.log(`  grading stamps: ${rows.length} leg(s) dated to their week's rollover`)
}

// ─── 3. Results the score can settle ───────────────────────────────────────

interface FinalGame {
  id: string
  home: string
  away: string
  homeScore: number
  awayScore: number
}

/** Every way a leg might name a team, pointing back at its abbreviation.
 *  Built from the teams table so it can't drift from the schedule. */
async function buildTeamAliases(): Promise<Map<string, string>> {
  const teams = await db.select().from(nflTeams)
  const map = new Map<string, string>()
  const add = (alias: string, abbr: string) => {
    const key = alias.toLowerCase().trim()
    // An alias that two teams share (e.g. "LA") is worse than no alias —
    // it would resolve to whichever team we happened to see last.
    if (map.has(key) && map.get(key) !== abbr) map.set(key, '')
    else map.set(key, abbr)
  }
  for (const t of teams) {
    add(t.abbr, t.abbr)
    add(t.name, t.abbr) // 'Cowboys'
    add(t.fullName, t.abbr) // 'Dallas Cowboys'
    add(t.city, t.abbr) // 'Dallas'
  }
  for (const [k, v] of map) if (v === '') map.delete(k)
  return map
}

/** The one team a description names, or null if it names none — or more
 *  than one, which we refuse rather than guess at. */
function findTeam(description: string, aliases: Map<string, string>): string | null {
  const found = new Set<string>()
  for (const word of description.toLowerCase().match(/[a-z]{2,}/g) ?? []) {
    const abbr = aliases.get(word)
    if (abbr) found.add(abbr)
  }
  return found.size === 1 ? [...found][0]! : null
}

/**
 * Grade one leg against its week's final scores, or return null when the
 * description isn't something a score can answer.
 *
 * Deliberately narrow. It reads a spread (`Phi -2.5`) or a moneyline
 * (`Colts ML`) and nothing else: those are the only two bets whose truth
 * is fully contained in the final score. Everything else — props, totals
 * with no team, anything with a player's name in it — comes back null and
 * gets reported rather than guessed.
 */
function gradeFromScore(
  description: string,
  games: FinalGame[],
  aliases: Map<string, string>
): { result: 'win' | 'loss' | 'push'; note: string } | null {
  const abbr = findTeam(description, aliases)
  if (!abbr) return null

  const game = games.find((g) => g.home === abbr || g.away === abbr)
  if (!game) return null

  const forTeam = game.home === abbr ? game.homeScore : game.awayScore
  const against = game.home === abbr ? game.awayScore : game.homeScore
  const margin = forTeam - against
  const line = `${game.away} ${game.awayScore}–${game.homeScore} ${game.home}`

  // Moneyline: "Colts ML", "Bills moneyline".
  if (/\b(ml|moneyline)\b/i.test(description)) {
    const result = margin > 0 ? 'win' : margin < 0 ? 'loss' : 'push'
    return { result, note: `${abbr} ML · ${line}` }
  }

  // Spread: "Phi -2.5", "Chargers +7". Must be a signed number standing on
  // its own — "70+ rush yards" is not a spread, and neither is "2 TDs".
  const spread = description.match(/(?:^|[\s(])([+-]\d+(?:\.\d+)?)(?![\d.]*\s*(?:\+|yard|yds|rec|rush|pt|point))/i)
  if (spread) {
    const handicap = parseFloat(spread[1]!)
    const adjusted = margin + handicap
    const result = adjusted > 0 ? 'win' : adjusted < 0 ? 'loss' : 'push'
    return { result, note: `${abbr} ${handicap > 0 ? '+' : ''}${handicap} · ${line}` }
  }

  return null
}

interface Ungraded {
  legId: string
  season: string
  weekNumber: number
  description: string
}

/**
 * Check the grader against the legs a human already settled.
 *
 * A grader that writes results has to earn it. This runs the same
 * function over every leg that already carries a hand-entered result and
 * reports where the two disagree — a disagreement is either a bug here or
 * a typo there, and both are worth seeing before trusting it on the legs
 * nobody graded.
 */
async function auditGrader() {
  const aliases = await buildTeamAliases()
  const rows = await db
    .select({
      description: parlayLegs.description,
      result: parlayLegs.result,
      nflWeekId: nflWeeks.id,
      season: nflWeeks.season,
      weekNumber: nflWeeks.weekNumber,
    })
    .from(parlayLegs)
    .innerJoin(parlays, eq(parlays.id, parlayLegs.parlayId))
    .innerJoin(nflWeeks, eq(nflWeeks.id, parlays.nflWeekId))
    .where(isNotNull(parlayLegs.result))
    .orderBy(asc(nflWeeks.season), asc(nflWeeks.weekNumber))

  const byWeek = new Map<string, FinalGame[]>()
  let agree = 0
  const disagree: string[] = []
  let abstain = 0

  for (const row of rows) {
    if (!byWeek.has(row.nflWeekId)) byWeek.set(row.nflWeekId, await finalsFor(row.nflWeekId))
    const verdict = gradeFromScore(row.description, byWeek.get(row.nflWeekId)!, aliases)
    if (!verdict) {
      abstain++
    } else if (verdict.result === row.result) {
      agree++
    } else {
      disagree.push(
        `  ${row.season} wk ${row.weekNumber}  "${row.description}" — book says ${row.result}, score says ${verdict.result}  (${verdict.note})`
      )
    }
  }

  console.log(
    `  ${agree} agree · ${disagree.length} disagree · ${abstain} abstained (not a score bet)`
  )
  for (const line of disagree) console.log(line)
}

/** Final scores for one week, keyed nowhere — callers cache by week id. */
async function finalsFor(nflWeekId: string): Promise<FinalGame[]> {
  const games = await db
    .select({
      id: nflGames.id,
      home: nflGames.homeTeam,
      away: nflGames.awayTeam,
      homeScore: nflGames.homeScore,
      awayScore: nflGames.awayScore,
    })
    .from(nflGames)
    .where(and(eq(nflGames.nflWeekId, nflWeekId), eq(nflGames.status, 'final')))
  return games
    .filter((g) => g.homeScore !== null && g.awayScore !== null)
    .map((g) => ({ ...g, homeScore: g.homeScore!, awayScore: g.awayScore! }))
}

async function gradeWhatWeCan(): Promise<{ graded: number; stuck: Ungraded[] }> {
  const aliases = await buildTeamAliases()

  const rows = await db
    .select({
      legId: parlayLegs.id,
      description: parlayLegs.description,
      nflWeekId: nflWeeks.id,
      season: nflWeeks.season,
      weekNumber: nflWeeks.weekNumber,
    })
    .from(parlayLegs)
    .innerJoin(parlays, eq(parlays.id, parlayLegs.parlayId))
    .innerJoin(nflWeeks, eq(nflWeeks.id, parlays.nflWeekId))
    .where(isNull(parlayLegs.result))
    .orderBy(asc(nflWeeks.season), asc(nflWeeks.weekNumber))

  const byWeek = new Map<string, FinalGame[]>()
  const stuck: Ungraded[] = []
  let graded = 0

  for (const row of rows) {
    if (!byWeek.has(row.nflWeekId))
      byWeek.set(row.nflWeekId, await finalsFor(row.nflWeekId))

    const verdict = gradeFromScore(row.description, byWeek.get(row.nflWeekId)!, aliases)
    if (!verdict) {
      stuck.push(row)
      continue
    }

    console.log(
      `  ${row.season} wk ${row.weekNumber}: "${row.description}" → ${verdict.result.toUpperCase()}  (${verdict.note})`
    )
    if (!DRY) {
      await db
        .update(parlayLegs)
        .set({ result: verdict.result, gradedAt: new Date(), gradedBy: 'auto' })
        .where(eq(parlayLegs.id, row.legId))
    }
    graded++
  }

  return { graded, stuck }
}

// ─── Run ───────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--audit-grader')) {
    console.log('Grader vs. the results a human already entered')
    await auditGrader()
    return
  }

  if (DRY) console.log('DRY RUN — nothing will be written.\n')

  const all = await db.select({ id: leagues.id, name: leagues.name }).from(leagues)
  for (const league of all) {
    console.log(`${league.name}`)
    await stampLocks(league.id)
  }

  console.log('\nGrading provenance')
  await stampGrading()

  console.log('\nResults the final score settles')
  const { graded, stuck } = await gradeWhatWeCan()
  console.log(`  ${graded} leg(s) graded from the box score`)

  if (stuck.length > 0) {
    console.log(
      `\n${stuck.length} leg(s) still ungraded — player props, which need box-score`
    )
    console.log('data this database does not hold. Settle these by hand:')
    for (const s of stuck) {
      console.log(`  ${s.season} wk ${s.weekNumber}  ${s.description}`)
    }
  }

  const [{ open }] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(leagueWeeks)
    .where(isNull(leagueWeeks.lockedAt))
  console.log(`\n${open} league-week(s) still open.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
