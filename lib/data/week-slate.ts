// Week-slate read model: the real NFL schedule for one league-week, shaped
// for the slate UI. Direct-db module (same precedent as lib/lock-time) —
// deliberately NOT on DataAdapter: the mock adapter has no games fixtures
// and the slate is neon-only infrastructure.
//
// Slate membership and the lock moment come from the same helpers the lock
// derivation uses (lib/lock-time), so the UI can never disagree with the
// enforced deadline.

import { db } from '@/db/client'
import { leagues, nflGames, nflTeams, nflWeeks } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCachedLockAt, isInSlate } from '@/lib/lock-time'

export interface SlateTeam {
  abbr: string
  name: string
  fullName: string
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
}

export interface SlateGame {
  /** ESPN event id (nfl_games.id). */
  id: string
  away: SlateTeam
  home: SlateTeam
  /** ISO kickoff timestamp. */
  kickoff: string
  scheduledDay: string
  isHolidayGame: boolean
  /** Whether this game counts toward the league's slate (config-driven). */
  inSlate: boolean
  /** Kickoff at 7pm ET or later — evening-window styling hook. */
  isPrimetime: boolean
  status: 'scheduled' | 'in-progress' | 'final' | 'postponed' | 'canceled'
  homeScore: number | null
  awayScore: number | null
  /** Quarter (5+ = OT); survives to final. */
  period: number | null
  /** Game clock while in progress ("7:24"); null otherwise. */
  displayClock: string | null
  network: string | null
  venue: string | null
}

export interface WeekSlatePayload {
  /** nfl_weeks id — the key the live-score endpoint is addressed by. */
  nflWeekId: string
  weekNumber: number
  season: string
  /** ALL games in the week, kickoff-ascending. UI filters on `inSlate`. */
  games: SlateGame[]
  /** The enforced submission deadline; null = TBD (no in-slate games). */
  lockAt: string | null
  /** Game whose kickoff anchors the lock — for "Locks 12:50p (PHI@DAL)" copy. */
  anchorGameId: string | null
  firstInSlateKickoff: string | null
}

// Teams are seeded separately from games (no strict FK), so tolerate a
// missing team row by synthesizing display data from the game's name fields.
function toSlateTeam(
  abbr: string,
  teamName: string,
  team: typeof nflTeams.$inferSelect | null
): SlateTeam {
  if (team) {
    return {
      abbr: team.abbr,
      name: team.name,
      fullName: team.fullName,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      logoUrl: team.logoUrl,
    }
  }
  return {
    abbr,
    name: teamName,
    fullName: teamName,
    primaryColor: null,
    secondaryColor: null,
    logoUrl: null,
  }
}

function isPrimetimeKickoff(kickoff: Date): boolean {
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(kickoff),
    10
  )
  return etHour >= 19
}

export async function getWeekSlate(
  leagueId: string,
  nflWeekId: string
): Promise<WeekSlatePayload | null> {
  const [league] = await db
    .select({
      slateDaysIncluded: leagues.slateDaysIncluded,
      slateIncludeHolidays: leagues.slateIncludeHolidays,
    })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)
  if (!league) return null

  const [week] = await db
    .select({ weekNumber: nflWeeks.weekNumber, season: nflWeeks.season })
    .from(nflWeeks)
    .where(eq(nflWeeks.id, nflWeekId))
    .limit(1)
  if (!week) return null

  const rows = await db
    .select({ game: nflGames })
    .from(nflGames)
    .where(eq(nflGames.nflWeekId, nflWeekId))

  // 32 rows, tiny — load the team table once instead of a double self-join.
  const teams = await db.select().from(nflTeams)
  const teamByAbbr = new Map(teams.map((t) => [t.abbr, t]))

  const games: SlateGame[] = rows
    .map(({ game }) => ({
      id: game.id,
      away: toSlateTeam(
        game.awayTeam,
        game.awayTeamName,
        teamByAbbr.get(game.awayTeam) ?? null
      ),
      home: toSlateTeam(
        game.homeTeam,
        game.homeTeamName,
        teamByAbbr.get(game.homeTeam) ?? null
      ),
      kickoff: game.kickoff.toISOString(),
      scheduledDay: game.scheduledDay,
      isHolidayGame: game.isHolidayGame,
      inSlate: isInSlate(game, league),
      isPrimetime: isPrimetimeKickoff(game.kickoff),
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      period: game.period,
      displayClock: game.displayClock,
      network: game.network,
      venue: game.venue,
    }))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))

  const inSlateGames = games.filter((g) => g.inSlate)
  const lockAt = await getCachedLockAt(leagueId, nflWeekId)

  return {
    nflWeekId,
    weekNumber: week.weekNumber,
    season: week.season,
    games,
    lockAt: lockAt?.toISOString() ?? null,
    anchorGameId: inSlateGames[0]?.id ?? null,
    firstInSlateKickoff: inSlateGames[0]?.kickoff ?? null,
  }
}

/** Week-1 slate of a given season — the preseason page's preview. */
export async function getSeasonOpenerSlate(
  leagueId: string,
  season: string
): Promise<WeekSlatePayload | null> {
  const [week] = await db
    .select({ id: nflWeeks.id })
    .from(nflWeeks)
    .where(and(eq(nflWeeks.season, season), eq(nflWeeks.weekNumber, 1)))
    .limit(1)
  if (!week) return null
  return getWeekSlate(leagueId, week.id)
}
