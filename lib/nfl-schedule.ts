// Shared NFL schedule loader. Used by:
//   - scripts/load-nfl-schedule.ts (CLI bootstrap)
//   - app/api/cron/refresh-schedule (nightly Vercel cron)
//
// Idempotent — every write is an upsert keyed on (id) for games or
// (season, week_number) for weeks. Safe to re-run any time.

import { db } from '@/db/client'
import { nflWeeks, nflGames } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// ─── Week catalog ──────────────────────────────────────────────────────────

export type WeekKind =
  | 'regular'
  | 'wildcard'
  | 'divisional'
  | 'conference'
  | 'super-bowl'

export interface WeekSpec {
  weekNumber: number
  kind: WeekKind
  espnSeasontype: 2 | 3
  espnWeek: number
}

export const WEEK_CATALOG: WeekSpec[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    weekNumber: i + 1,
    kind: 'regular' as WeekKind,
    espnSeasontype: 2 as const,
    espnWeek: i + 1,
  })),
  { weekNumber: 19, kind: 'wildcard', espnSeasontype: 3, espnWeek: 1 },
  { weekNumber: 20, kind: 'divisional', espnSeasontype: 3, espnWeek: 2 },
  { weekNumber: 21, kind: 'conference', espnSeasontype: 3, espnWeek: 3 },
  { weekNumber: 22, kind: 'super-bowl', espnSeasontype: 3, espnWeek: 5 }, // 4 = Pro Bowl
]

// ─── ESPN types ────────────────────────────────────────────────────────────

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string | number
  team: { abbreviation: string; displayName: string; name?: string }
}

interface EspnStatus {
  /** Quarter (1–4, 5+ = OT). Absent before kickoff. */
  period?: number
  /** "7:24" — game clock as ESPN formats it. */
  displayClock?: string
  type?: { name?: string }
}

interface EspnEvent {
  id: string
  date: string
  name: string
  shortName?: string
  competitions: Array<{
    competitors: EspnCompetitor[]
    venue?: { fullName?: string }
    broadcasts?: Array<{ market?: string; names?: string[] }>
    status?: EspnStatus
  }>
  status?: EspnStatus
}

interface EspnResponse {
  events?: EspnEvent[]
}

export async function fetchWeek(year: number, spec: WeekSpec): Promise<EspnEvent[]> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
    `?dates=${year}&seasontype=${spec.espnSeasontype}&week=${spec.espnWeek}&limit=50`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} for week ${spec.weekNumber}`)
  }
  const json = (await res.json()) as EspnResponse
  return json.events ?? []
}

function mapStatus(
  name?: string
): 'scheduled' | 'in-progress' | 'final' | 'postponed' | 'canceled' {
  switch (name) {
    case 'STATUS_SCHEDULED': return 'scheduled'
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_HALFTIME':
    case 'STATUS_END_PERIOD':
    case 'STATUS_DELAYED': return 'in-progress'
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME': return 'final'
    case 'STATUS_POSTPONED': return 'postponed'
    case 'STATUS_CANCELED':
    case 'STATUS_FORFEIT': return 'canceled'
    default: return 'scheduled'
  }
}

function extractNetwork(ev: EspnEvent): string | null {
  const broadcasts = ev.competitions?.[0]?.broadcasts ?? []
  const national = broadcasts.find((b) => b.market === 'national')
  const name = (national ?? broadcasts[0])?.names?.[0]
  return name ?? null
}

// ─── Day + holiday derivation ──────────────────────────────────────────────

const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function etPartsOf(date: Date): {
  year: number
  month: number
  day: number
  weekday: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const weekdayShort = get('weekday').toLowerCase().slice(0, 3)
  const weekday = DAY_MAP.indexOf(weekdayShort as (typeof DAY_MAP)[number])
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    weekday: weekday < 0 ? 0 : weekday,
  }
}

export function scheduledDayOf(kickoff: Date): string {
  return DAY_MAP[etPartsOf(kickoff).weekday]
}

function thanksgivingDate(year: number): { day: number } {
  let day = 1
  while (true) {
    const d = new Date(Date.UTC(year, 10, day, 17, 0, 0))
    const wd = etPartsOf(d).weekday
    if (wd === 4) break
    day++
  }
  return { day: day + 21 }
}

export function isHolidayKickoff(kickoff: Date): boolean {
  const et = etPartsOf(kickoff)
  if (et.month === 12 && et.day === 25) return true
  const tg = thanksgivingDate(et.year)
  if (et.month === 11 && (et.day === tg.day || et.day === tg.day + 1)) return true
  return false
}

// ─── Upsert helpers ────────────────────────────────────────────────────────

export async function upsertNflWeek(
  season: string,
  spec: WeekSpec,
  kickoffs: Date[]
): Promise<string> {
  const sorted = kickoffs.slice().sort((a, b) => a.getTime() - b.getTime())
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  let startDate: Date | null = null
  let endDate: Date | null = null
  if (first && last) {
    startDate = first
    endDate = new Date(last.getTime())
    endDate.setUTCDate(endDate.getUTCDate() + 3)
    endDate.setUTCHours(9, 0, 0, 0)
  }

  const existing = await db
    .select({ id: nflWeeks.id })
    .from(nflWeeks)
    .where(and(eq(nflWeeks.season, season), eq(nflWeeks.weekNumber, spec.weekNumber)))
    .limit(1)

  if (existing[0]) {
    await db
      .update(nflWeeks)
      .set({ kind: spec.kind, startDate, endDate })
      .where(eq(nflWeeks.id, existing[0].id))
    return existing[0].id
  }

  const [row] = await db
    .insert(nflWeeks)
    .values({ season, weekNumber: spec.weekNumber, kind: spec.kind, startDate, endDate })
    .returning({ id: nflWeeks.id })
  return row.id
}

export interface UpsertedWeek {
  weekNumber: number
  weekId: string
  games: number
}

export async function upsertGames(
  nflWeekId: string,
  events: EspnEvent[]
): Promise<number> {
  if (events.length === 0) return 0
  for (const ev of events) {
    const comp = ev.competitions?.[0]
    const home = comp?.competitors.find((c) => c.homeAway === 'home')
    const away = comp?.competitors.find((c) => c.homeAway === 'away')
    if (!home || !away) {
      throw new Error(`Missing home/away competitor on event ${ev.id}`)
    }
    const espnStatus = ev.status ?? comp?.status
    const status = mapStatus(espnStatus?.type?.name)
    // ESPN reports 0–0 for games that haven't kicked off; storing that as a
    // real score makes every future game look played. Scores are null until
    // the ball is actually in the air.
    const played = status === 'in-progress' || status === 'final'
    const parseScore = (raw: string | number | undefined) => {
      if (!played || raw == null) return null
      const n = parseInt(String(raw), 10)
      return Number.isFinite(n) ? n : null
    }
    const homeScore = parseScore(home.score)
    const awayScore = parseScore(away.score)
    const period = played && espnStatus?.period != null ? espnStatus.period : null
    const displayClock = status === 'in-progress' ? espnStatus?.displayClock ?? null : null
    const kickoff = new Date(ev.date)
    const row = {
      id: ev.id,
      nflWeekId,
      homeTeam: home.team.abbreviation,
      awayTeam: away.team.abbreviation,
      homeTeamName: home.team.displayName,
      awayTeamName: away.team.displayName,
      kickoff,
      scheduledDay: scheduledDayOf(kickoff),
      isHolidayGame: isHolidayKickoff(kickoff),
      homeScore,
      awayScore,
      status,
      period,
      displayClock,
      network: extractNetwork(ev),
      venue: comp?.venue?.fullName ?? null,
      finalAt: status === 'final' ? new Date() : null,
    }
    await db
      .insert(nflGames)
      .values(row)
      .onConflictDoUpdate({
        target: nflGames.id,
        set: {
          nflWeekId: row.nflWeekId,
          homeTeam: row.homeTeam,
          awayTeam: row.awayTeam,
          homeTeamName: row.homeTeamName,
          awayTeamName: row.awayTeamName,
          kickoff: row.kickoff,
          // scheduledDay deliberately not updated — keeps slate stable
          // across postponement-shift kickoff changes.
          isHolidayGame: row.isHolidayGame,
          homeScore: row.homeScore,
          awayScore: row.awayScore,
          status: row.status,
          period: row.period,
          displayClock: row.displayClock,
          network: row.network,
          venue: row.venue,
          finalAt: row.finalAt,
          updatedAt: new Date(),
        },
      })
  }
  return events.length
}

// ─── Top-level orchestrator ────────────────────────────────────────────────

export async function syncSeason(
  year: number,
  options: { weekNumbers?: number[] } = {}
): Promise<{ season: string; weeksTouched: UpsertedWeek[]; totalGames: number }> {
  const season = `${year}-${year + 1}`
  const weeksToLoad = options.weekNumbers
    ? WEEK_CATALOG.filter((w) => options.weekNumbers!.includes(w.weekNumber))
    : WEEK_CATALOG

  const touched: UpsertedWeek[] = []
  let totalGames = 0
  for (const spec of weeksToLoad) {
    const events = await fetchWeek(year, spec)
    const kickoffs = events.map((e) => new Date(e.date))
    const weekId = await upsertNflWeek(season, spec, kickoffs)
    const inserted = await upsertGames(weekId, events)
    totalGames += inserted
    touched.push({ weekNumber: spec.weekNumber, weekId, games: inserted })
  }

  return { season, weeksTouched: touched, totalGames }
}
