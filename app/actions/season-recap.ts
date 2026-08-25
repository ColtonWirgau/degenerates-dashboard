'use server'

/**
 * THE RECAP — a finished season, read back as a story.
 *
 * A season that's over is a different object from a season in progress.
 * Nothing about it can change, nobody needs a deadline, and "week 14 of
 * 18" is no longer the useful frame. What's left is: how did it go, how
 * did YOU go, and who is never living down what they did in week 5.
 *
 * Everything here comes off the legs the league actually entered. No
 * award is invented and none is graded on a curve: if nobody qualifies,
 * the award doesn't appear.
 *
 * Each one is a title, a name and a number, and nothing else. There were
 * written punchlines under them for a while — "the group chat was right
 * there" — but every league would have got the same ones every season,
 * and a joke that repeats verbatim each year stops being a joke by its
 * second telling. The numbers are funnier anyway: 0/16 needs no help.
 */

import { db } from '@/db/client'
import { and, eq } from 'drizzle-orm'
import { nflWeeks, parlayLegs, parlays, users } from '@/db/schema'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDataAdapter } from '@/lib/data/adapter'

export interface RecapLeg {
  weekNumber: number
  userId: string
  name: string
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
}

export interface RecapWeek {
  weekNumber: number
  legs: number
  losses: number
  /** Nobody missed — the whole ticket cashed. */
  hit: boolean
  /** The names on the losing legs, in leg order. */
  killedBy: string[]
}

export interface RecapPerson {
  userId: string
  name: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  wins: number
  losses: number
  pushes: number
  winRate: number
  weeksIn: number
  /** Longest run of winning legs, week over week. */
  streak: number
  /** Chronological result per week that took legs — feeds the dot trace. */
  trace: Array<{ weekNumber: number; result: 'win' | 'loss' | 'push' | null }>
}

export interface RecapAward {
  /** Stable key so the UI can pick an icon without matching on prose. */
  key: string
  /** The award, named. */
  title: string
  /** Who won it. */
  name: string
  userId: string | null
  /** The number that won it, set big. */
  figure: string
  tone: 'good' | 'bad'
}

export interface SeasonRecapPayload {
  season: string
  weeksPlayed: number
  parlaysHit: number
  totalLegs: number
  legWins: number
  legLosses: number
  people: RecapPerson[]
  weeks: RecapWeek[]
  awards: RecapAward[]
  /** The viewer, if they played. */
  meId: string
}

const firstName = (name: string | null, email: string) =>
  (name ?? email.split('@')[0] ?? email).split(' ')[0]!

const fmtOdds = (n: number) => (n > 0 ? `+${n}` : String(n))

export async function getSeasonRecap(
  leagueId: string,
  season: string
): Promise<{ error: string | null; payload: SeasonRecapPayload | null }> {
  const me = await getCurrentUser()
  if (!me) return { error: 'Unauthorized', payload: null }
  const adapter = await getDataAdapter()
  const league = await adapter.getLeague(leagueId, me.id)
  if (!league) {
    return { error: 'Access denied - not a member of this league', payload: null }
  }

  const rows = await db
    .select({
      weekNumber: nflWeeks.weekNumber,
      userId: parlayLegs.userId,
      name: users.name,
      email: users.email,
      avatarUrl: users.image,
      description: parlayLegs.description,
      odds: parlayLegs.odds,
      result: parlayLegs.result,
    })
    .from(parlays)
    .innerJoin(nflWeeks, eq(parlays.nflWeekId, nflWeeks.id))
    .innerJoin(parlayLegs, eq(parlayLegs.parlayId, parlays.id))
    .innerJoin(users, eq(parlayLegs.userId, users.id))
    .where(and(eq(parlays.leagueId, leagueId), eq(nflWeeks.season, season)))

  if (rows.length === 0) return { error: null, payload: null }

  const legs: RecapLeg[] = rows.map((r) => ({
    weekNumber: r.weekNumber,
    userId: r.userId,
    name: firstName(r.name, r.email),
    description: r.description,
    odds: Number(r.odds) || 0,
    result: r.result,
  }))

  const weekNumbers = [...new Set(legs.map((l) => l.weekNumber))].sort((a, b) => a - b)

  const weeks: RecapWeek[] = weekNumbers.map((w) => {
    const inWeek = legs.filter((l) => l.weekNumber === w)
    const down = inWeek.filter((l) => l.result === 'loss')
    return {
      weekNumber: w,
      legs: inWeek.length,
      losses: down.length,
      hit: down.length === 0,
      killedBy: down.map((l) => l.name),
    }
  })

  // ─── The people ───────────────────────────────────────────────────
  const byUser = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, [])
    byUser.get(r.userId)!.push(r)
  }

  const people: RecapPerson[] = [...byUser.entries()]
    .map(([userId, mine]) => {
      const sorted = [...mine].sort((a, b) => a.weekNumber - b.weekNumber)
      const wins = sorted.filter((r) => r.result === 'win').length
      const losses = sorted.filter((r) => r.result === 'loss').length
      const pushes = sorted.filter((r) => r.result === 'push').length
      let streak = 0
      let run = 0
      for (const r of sorted) {
        if (r.result === 'win') {
          run++
          if (run > streak) streak = run
        } else run = 0
      }
      const decided = wins + losses
      return {
        userId,
        name: firstName(sorted[0]!.name, sorted[0]!.email),
        fullName: sorted[0]!.name,
        email: sorted[0]!.email,
        avatarUrl: sorted[0]!.avatarUrl,
        wins,
        losses,
        pushes,
        winRate: decided === 0 ? 0 : Math.round((wins / decided) * 100),
        weeksIn: new Set(sorted.map((r) => r.weekNumber)).size,
        streak,
        trace: sorted.map((r) => ({ weekNumber: r.weekNumber, result: r.result })),
      }
    })
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)

  // ─── The awards ───────────────────────────────────────────────────
  const awards: RecapAward[] = []
  const byName = (n: string) => people.find((p) => p.name === n)?.userId ?? null

  // THE ONE THAT GOT AWAY — the week the ticket came closest, and the
  // one person standing between the league and a payday. Only counts
  // when exactly one leg missed, because that's when it's personal.
  const soleKills = weeks.filter((w) => w.losses === 1)
  const closest = soleKills.sort((a, b) => b.legs - a.legs)[0]
  if (closest) {
    const villain = closest.killedBy[0]!
    awards.push({
      key: 'one-that-got-away',
      title: 'The one that got away',
      name: villain,
      userId: byName(villain),
      figure: `${closest.legs - 1}/${closest.legs}`,
      tone: 'bad',
    })
  }

  // SERIAL KILLER — did it alone more than once. Skipped when nobody did.
  const soleCounts = new Map<string, number[]>()
  for (const w of soleKills) {
    const n = w.killedBy[0]!
    soleCounts.set(n, [...(soleCounts.get(n) ?? []), w.weekNumber])
  }
  const repeat = [...soleCounts.entries()]
    .filter(([, ws]) => ws.length > 1)
    .sort((a, b) => b[1].length - a[1].length)[0]
  if (repeat) {
    awards.push({
      key: 'serial-killer',
      title: 'Serial offender',
      name: repeat[0],
      userId: byName(repeat[0]),
      figure: `×${repeat[1].length}`,
      tone: 'bad',
    })
  }

  // LONGEST SHOT THAT LANDED.
  const longest = legs
    .filter((l) => l.result === 'win')
    .sort((a, b) => b.odds - a.odds)[0]
  if (longest) {
    awards.push({
      key: 'longest-shot',
      title: 'Longest shot that landed',
      name: longest.name,
      userId: longest.userId,
      figure: fmtOdds(longest.odds),
      tone: 'good',
    })
  }

  // HEAVIEST CHALK THAT STILL FOUND A WAY TO LOSE.
  const chalk = legs
    .filter((l) => l.result === 'loss' && l.odds < 0)
    .sort((a, b) => a.odds - b.odds)[0]
  if (chalk) {
    awards.push({
      key: 'chalk',
      title: 'Laid the number, lost anyway',
      name: chalk.name,
      userId: chalk.userId,
      figure: fmtOdds(chalk.odds),
      tone: 'bad',
    })
  }

  // BEST RECORD — min 8 decided legs so a 2–0 cameo can't win it.
  const best = people.filter((p) => p.wins + p.losses >= 8)[0]
  if (best) {
    awards.push({
      key: 'best-record',
      title: 'Best of a bad bunch',
      name: best.name,
      userId: best.userId,
      figure: `${best.wins}–${best.losses}`,
      tone: 'good',
    })
  }

  // HOT STREAK.
  const hottest = [...people].sort((a, b) => b.streak - a.streak)[0]
  if (hottest && hottest.streak >= 3) {
    awards.push({
      key: 'streak',
      title: 'Longest heater',
      name: hottest.name,
      userId: hottest.userId,
      figure: `${hottest.streak} straight`,
      tone: 'good',
    })
  }

  // IRON MAN vs GHOST — only worth saying when there's a real gap.
  const maxWeeks = Math.max(...people.map((p) => p.weeksIn))
  const ghost = [...people].sort((a, b) => a.weeksIn - b.weeksIn)[0]
  if (ghost && ghost.weeksIn < maxWeeks - 2) {
    awards.push({
      key: 'ghost',
      title: 'Hard to reach',
      name: ghost.name,
      userId: ghost.userId,
      figure: `${maxWeeks - ghost.weeksIn} no-shows`,
      tone: 'bad',
    })
  }

  // THE WIPEOUT — a week where every single leg went down.
  const wipeout = weeks
    .filter((w) => w.legs >= 5 && w.losses === w.legs)
    .sort((a, b) => b.legs - a.legs)[0]
  if (wipeout) {
    awards.push({
      key: 'wipeout',
      title: 'Total wipeout',
      name: `Week ${wipeout.weekNumber}`,
      userId: null,
      figure: `0/${wipeout.legs}`,
      tone: 'bad',
    })
  }

  const parlaysHit = weeks.filter((w) => w.hit).length

  return {
    error: null,
    payload: {
      season,
      weeksPlayed: weeks.length,
      parlaysHit,
      totalLegs: legs.length,
      legWins: legs.filter((l) => l.result === 'win').length,
      legLosses: legs.filter((l) => l.result === 'loss').length,
      people,
      weeks,
      awards,
      meId: me.id,
    },
  }
}
