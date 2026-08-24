// Neon adapter — implements DataAdapter against Drizzle/Postgres.
// Counterpart of mock-adapter. Selected by setting
// `NEXT_PUBLIC_DATA_SOURCE=neon` in env.
//
// Conventions:
//   - All reads use the shared `db` client from db/client.ts
//   - Domain rows are mapped to the types in lib/data/types.ts via small
//     row→shape helpers at the top of this file
//   - Derived fields (parlay state, totalOdds) are computed on read; nothing
//     stored that the schema can produce
//   - getSeasonState branches off `now` against the nfl_weeks table

import { and, asc, desc, eq, inArray, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { getDevNow } from './dev-now'
import { getCachedLockAt } from '@/lib/lock-time'
import {
  charterApprovals,
  charterEntries,
  leagueMembers,
  leagues,
  nflWeeks,
  parlayLegs,
  parlays,
  pollOptionReactions,
  pollOptions,
  pollResponses,
  polls,
  users,
} from '@/db/schema'
import type {
  CreateCharterEntryInput,
  CreatePollInput,
  DataAdapter,
  PollVote,
} from './adapter'
import type {
  LeaderboardEntry,
  League,
  LeagueMember,
  LegResult,
  NflWeek,
  Parlay,
  ParlayLeg,
  ParlayState,
  Role,
  SeasonState,
  SubmitLegInput,
  User,
  UserSeasonStats,
  WeekKind,
} from './types'
import type {
  CharterEntry,
  CharterApprovalRule,
  CharterCategory,
  CharterStatus,
} from './mock-charter'
import type {
  LeaguePoll,
  PollKind,
  PollOption,
  PollOptionPolicy,
  PollResponse,
  PollStatus,
} from './mock-polls'
import { STANDARD_CHARTER_TEMPLATES } from './mock-charter'
import { STANDARD_POLL_TEMPLATES } from './mock-polls'

// ─── Row → shape mappers ──────────────────────────────────────────────────

function userFromRow(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.name,
    avatarUrl: row.image,
  }
}

function leagueFromRow(row: typeof leagues.$inferSelect): League {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.inviteCode,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? '',
  }
}

function nflWeekFromRow(row: typeof nflWeeks.$inferSelect): NflWeek {
  return {
    id: row.id,
    weekNumber: row.weekNumber,
    season: row.season,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    kind: row.kind as WeekKind,
  }
}

function parlayLegFromRow(
  leg: typeof parlayLegs.$inferSelect,
  user: User
): ParlayLeg {
  return {
    id: leg.id,
    parlayId: leg.parlayId,
    user,
    legNumber: leg.legNumber,
    description: leg.description,
    odds: leg.odds,
    result: leg.result,
    lockedAt: leg.lockedAt?.toISOString() ?? null,
    createdAt: leg.createdAt.toISOString(),
    validationStatus: leg.validationStatus ?? null,
    validationMessage: leg.validationMessage ?? null,
  }
}

// ─── Derived helpers ──────────────────────────────────────────────────────

function americanToDecimal(american: number): number {
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american)
}
function decimalToAmerican(decimal: number): string {
  return decimal >= 2
    ? `+${Math.round((decimal - 1) * 100)}`
    : `${Math.round(-100 / (decimal - 1))}`
}
function computeTotalOdds(legs: ParlayLeg[]): string | null {
  if (legs.length === 0) return null
  const product = legs.reduce((acc, l) => acc * americanToDecimal(l.odds), 1)
  return decimalToAmerican(product)
}

function computeParlayState(
  legs: ParlayLeg[],
  expectedMembers: number
): { state: ParlayState; result: 'won' | 'lost' | null } {
  if (legs.length === 0) return { state: 'open', result: null }
  const anyDraft = legs.some((l) => l.lockedAt === null)
  if (anyDraft || legs.length < expectedMembers) {
    return { state: 'open', result: null }
  }
  const anyResult = legs.some((l) => l.result !== null)
  if (!anyResult) return { state: 'locked', result: null }
  const allGraded = legs.every((l) => l.result !== null)
  if (!allGraded) return { state: 'graded', result: null }
  const anyLoss = legs.some((l) => l.result === 'loss')
  if (anyLoss) return { state: 'lost', result: 'lost' }
  return { state: 'won', result: 'won' }
}

// Loads the full parlay shape (week + legs + users + derived state).
async function buildParlay(parlayId: string): Promise<Parlay | null> {
  const parlayRow = await db.query.parlays.findFirst({
    where: eq(parlays.id, parlayId),
    with: {
      nflWeek: true,
      legs: { with: { user: true } },
    },
  })
  if (!parlayRow) return null

  // Member count for state computation — without it 'locked' fires too
  // early when not everyone has submitted yet.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, parlayRow.leagueId))

  const legs: ParlayLeg[] = parlayRow.legs.map((l) =>
    parlayLegFromRow(l, userFromRow(l.user))
  )
  const { state, result } = computeParlayState(legs, count ?? 0)
  const lockAt = await getCachedLockAt(parlayRow.leagueId, parlayRow.nflWeekId)

  return {
    id: parlayRow.id,
    leagueId: parlayRow.leagueId,
    week: nflWeekFromRow(parlayRow.nflWeek),
    legs,
    totalOdds: computeTotalOdds(legs),
    state,
    result,
    lockAt: lockAt?.toISOString() ?? null,
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────

export const neonAdapter: DataAdapter = {
  // ── Leagues / membership ────────────────────────────────────────────
  async getLeaguesForUser(userId) {
    const rows = await db
      .select({ league: leagues })
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagues.id, leagueMembers.leagueId))
      .where(eq(leagueMembers.userId, userId))
      .orderBy(desc(leagues.createdAt))
    return rows.map((r) => leagueFromRow(r.league))
  },

  async getLeague(leagueId, userId) {
    const membership = await db
      .select()
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, userId)
        )
      )
      .limit(1)
    if (membership.length === 0) return null
    const row = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1)
    return row[0] ? leagueFromRow(row[0]) : null
  },

  async getLeagueMembers(leagueId) {
    const rows = await db
      .select({ member: leagueMembers, user: users })
      .from(leagueMembers)
      .innerJoin(users, eq(users.id, leagueMembers.userId))
      .where(eq(leagueMembers.leagueId, leagueId))
      .orderBy(asc(leagueMembers.joinedAt))
    return rows.map(
      (r): LeagueMember => ({
        user: userFromRow(r.user),
        role: r.member.role as Role,
        joinedAt: r.member.joinedAt.toISOString(),
      })
    )
  },

  async getUserRole(leagueId, userId) {
    const row = await db
      .select({ role: leagueMembers.role })
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, userId)
        )
      )
      .limit(1)
    return (row[0]?.role as Role | undefined) ?? null
  },

  // ── Weeks / season state ────────────────────────────────────────────
  async getWeeksForSeason(season) {
    const rows = await db
      .select()
      .from(nflWeeks)
      .where(eq(nflWeeks.season, season))
      .orderBy(asc(nflWeeks.weekNumber))
    return rows.map(nflWeekFromRow)
  },

  async getCurrentWeek(season) {
    const now = await getDevNow()
    const row = await db
      .select()
      .from(nflWeeks)
      .where(
        and(
          eq(nflWeeks.season, season),
          lte(nflWeeks.startDate, now),
          gte(nflWeeks.endDate, now)
        )
      )
      .limit(1)
    return row[0] ? nflWeekFromRow(row[0]) : null
  },

  async getSeasonState() {
    // Pick the season the page should focus on. Heuristic: the latest
    // season in the DB whose first kickoff is closest to now (either
    // upcoming or actively running). Falls back to the lone season.
    const allSeasons = await db
      .selectDistinct({ season: nflWeeks.season })
      .from(nflWeeks)
    if (allSeasons.length === 0) {
      // Empty DB — synthesize an "offseason, schedule unknown" reply.
      const year = new Date().getUTCFullYear()
      return {
        kind: 'offseason',
        lastSeason: null,
        nextSeason: `${year}-${year + 1}`,
        expectedKickoff: null,
      }
    }
    // Sort seasons by starting year (e.g. '2026-2027' → 2026), newest first
    const sorted = [...allSeasons].sort((a, b) => {
      const ay = parseInt(a.season.split('-')[0]!, 10)
      const by = parseInt(b.season.split('-')[0]!, 10)
      return by - ay
    })

    // Focus season — now-aware: prefer the season whose schedule window
    // contains `now` (actively running), then the nearest upcoming one,
    // then the most recent past season. Keeps the state machine correct
    // when the DB holds multiple seasons and when dev time-travel pins
    // `now` inside a completed season.
    const now = await getDevNow()
    type WeekList = Awaited<ReturnType<typeof this.getWeeksForSeason>>
    let focusSeason: string | null = null
    let weeks: WeekList = []
    let upcoming: { season: string; weeks: WeekList } | null = null
    for (const { season } of sorted) {
      const w = await this.getWeeksForSeason(season)
      const first = w[0]?.startDate ? new Date(w[0].startDate) : null
      const last = w[w.length - 1]?.endDate
        ? new Date(w[w.length - 1]!.endDate!)
        : null
      if (first && last && first <= now && now <= last) {
        focusSeason = season
        weeks = w
        break
      }
      // Descending order → the last season with `now < first` is the
      // earliest upcoming one.
      if (first && now < first) upcoming = { season, weeks: w }
    }
    if (!focusSeason) {
      if (upcoming) {
        focusSeason = upcoming.season
        weeks = upcoming.weeks
      } else {
        focusSeason = sorted[0]!.season
        weeks = await this.getWeeksForSeason(focusSeason)
      }
    }

    const firstWeek = weeks[0]
    const lastWeek = weeks[weeks.length - 1]
    if (!firstWeek || !lastWeek) {
      const year = parseInt(focusSeason.split('-')[0]!, 10)
      return {
        kind: 'offseason',
        lastSeason: `${year - 1}-${year}`,
        nextSeason: focusSeason,
        expectedKickoff: null,
      }
    }

    const startYear = parseInt(focusSeason.split('-')[0]!, 10)
    const firstStart = firstWeek.startDate ? new Date(firstWeek.startDate) : null
    const lastEnd = lastWeek.endDate ? new Date(lastWeek.endDate) : null

    // Before week 1 → offseason or preseason
    if (firstStart && now < firstStart) {
      const daysUntilKickoff = Math.ceil(
        (firstStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysUntilKickoff > 60) {
        return {
          kind: 'offseason',
          lastSeason: `${startYear - 1}-${startYear}`,
          nextSeason: focusSeason,
          expectedKickoff: daysUntilKickoff > 120 ? null : firstWeek.startDate,
        }
      }
      return {
        kind: 'preseason',
        nextKickoff: firstWeek.startDate!,
        daysUntilKickoff,
        currentSeason: focusSeason,
      }
    }

    // After final week → next offseason
    if (lastEnd && now > lastEnd) {
      return {
        kind: 'offseason',
        lastSeason: focusSeason,
        nextSeason: `${startYear + 1}-${startYear + 2}`,
        expectedKickoff: null,
      }
    }

    // Mid-season: pick active week or next upcoming
    const active = weeks.find(
      (w) =>
        w.startDate &&
        w.endDate &&
        new Date(w.startDate) <= now &&
        new Date(w.endDate) >= now
    )
    const target =
      active ?? weeks.find((w) => w.startDate && new Date(w.startDate) > now) ?? lastWeek

    if (target.kind === 'super-bowl') {
      return { kind: 'super-bowl', activeWeek: target }
    }
    if (
      target.kind === 'wildcard' ||
      target.kind === 'divisional' ||
      target.kind === 'conference'
    ) {
      const labels: Record<string, string> = {
        wildcard: 'Wildcard Weekend',
        divisional: 'Divisional Round',
        conference: 'Conference Championships',
      }
      return {
        kind: 'playoffs',
        activeWeek: target,
        roundLabel: labels[target.kind]!,
      }
    }
    const regularWeeks = weeks.filter((w) => w.kind === 'regular')
    const idx = regularWeeks.findIndex((w) => w.id === target.id)
    const isLive = !!active && active.id === target.id
    return {
      kind: 'regular-season',
      activeWeek: target,
      weeksRemaining: idx >= 0 ? Math.max(0, regularWeeks.length - 1 - idx) : 0,
      isLive,
      nextWeek: isLive ? null : target,
    }
  },

  // ── Parlays ─────────────────────────────────────────────────────────
  async getWeekParlay(leagueId, weekId) {
    const row = await db
      .select({ id: parlays.id })
      .from(parlays)
      .where(and(eq(parlays.leagueId, leagueId), eq(parlays.nflWeekId, weekId)))
      .limit(1)
    if (!row[0]) return null
    return buildParlay(row[0].id)
  },

  async ensureWeekParlay(leagueId, nflWeekId) {
    const existing = await db
      .select({ id: parlays.id })
      .from(parlays)
      .where(and(eq(parlays.leagueId, leagueId), eq(parlays.nflWeekId, nflWeekId)))
      .limit(1)
    if (existing[0]) return buildParlay(existing[0].id)

    // The (league_id, nfl_week_id) unique constraint makes this race-safe:
    // a concurrent creator wins silently and we re-read their row.
    const inserted = await db
      .insert(parlays)
      .values({ leagueId, nflWeekId })
      .onConflictDoNothing()
      .returning({ id: parlays.id })
    if (inserted[0]) return buildParlay(inserted[0].id)

    const raced = await db
      .select({ id: parlays.id })
      .from(parlays)
      .where(and(eq(parlays.leagueId, leagueId), eq(parlays.nflWeekId, nflWeekId)))
      .limit(1)
    return raced[0] ? buildParlay(raced[0].id) : null
  },

  async getParlay(parlayId) {
    return buildParlay(parlayId)
  },

  async getLeagueParlays(leagueId, season) {
    // Find all parlays whose nfl_week is in the given season, ordered by week.
    const rows = await db
      .select({ id: parlays.id, weekNumber: nflWeeks.weekNumber })
      .from(parlays)
      .innerJoin(nflWeeks, eq(nflWeeks.id, parlays.nflWeekId))
      .where(and(eq(parlays.leagueId, leagueId), eq(nflWeeks.season, season)))
      .orderBy(asc(nflWeeks.weekNumber))

    const results: Parlay[] = []
    for (const r of rows) {
      const p = await buildParlay(r.id)
      if (p) results.push(p)
    }
    return results
  },

  // ── Stats ───────────────────────────────────────────────────────────
  async getLeaderboard(leagueId, season) {
    // Join legs → parlays → nfl_weeks → filter by season, group by user.
    const legRows = await db
      .select({
        userId: parlayLegs.userId,
        result: parlayLegs.result,
        user: users,
      })
      .from(parlayLegs)
      .innerJoin(parlays, eq(parlays.id, parlayLegs.parlayId))
      .innerJoin(nflWeeks, eq(nflWeeks.id, parlays.nflWeekId))
      .innerJoin(users, eq(users.id, parlayLegs.userId))
      .where(
        and(eq(parlays.leagueId, leagueId), eq(nflWeeks.season, season))
      )

    // Bucket by user.
    const buckets = new Map<
      string,
      { user: User; wins: number; losses: number; pushes: number; pending: number }
    >()
    for (const r of legRows) {
      const u = userFromRow(r.user)
      const b = buckets.get(u.id) ?? {
        user: u,
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
      }
      if (r.result === 'win') b.wins++
      else if (r.result === 'loss') b.losses++
      else if (r.result === 'push') b.pushes++
      else b.pending++
      buckets.set(u.id, b)
    }

    // Ensure every league member shows up even if they have no legs yet.
    const members = await this.getLeagueMembers(leagueId)
    for (const m of members) {
      if (!buckets.has(m.user.id)) {
        buckets.set(m.user.id, {
          user: m.user,
          wins: 0,
          losses: 0,
          pushes: 0,
          pending: 0,
        })
      }
    }

    const entries: LeaderboardEntry[] = Array.from(buckets.values()).map((b) => {
      const total = b.wins + b.losses + b.pushes + b.pending
      const decided = b.wins + b.losses
      return {
        userId: b.user.id,
        user: b.user,
        wins: b.wins,
        losses: b.losses,
        pushes: b.pushes,
        pending: b.pending,
        total,
        winRate: decided === 0 ? 0 : Math.round((b.wins / decided) * 100),
      }
    })

    // Sort: most wins desc, then highest win rate, then alpha.
    entries.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.winRate !== a.winRate) return b.winRate - a.winRate
      return (a.user.fullName ?? a.user.email).localeCompare(
        b.user.fullName ?? b.user.email
      )
    })
    return entries
  },

  async getUserStats(leagueId, userId, season) {
    const legRows = await db
      .select({ result: parlayLegs.result })
      .from(parlayLegs)
      .innerJoin(parlays, eq(parlays.id, parlayLegs.parlayId))
      .innerJoin(nflWeeks, eq(nflWeeks.id, parlays.nflWeekId))
      .where(
        and(
          eq(parlays.leagueId, leagueId),
          eq(nflWeeks.season, season),
          eq(parlayLegs.userId, userId)
        )
      )
    let wins = 0,
      losses = 0,
      pushes = 0,
      pending = 0
    for (const r of legRows) {
      if (r.result === 'win') wins++
      else if (r.result === 'loss') losses++
      else if (r.result === 'push') pushes++
      else pending++
    }
    const total = wins + losses + pushes + pending
    const decided = wins + losses
    const stats: UserSeasonStats = {
      userId,
      wins,
      losses,
      pushes,
      pending,
      total,
      winRate: decided === 0 ? 0 : Math.round((wins / decided) * 100),
    }
    return stats
  },

  // ── Mutations ───────────────────────────────────────────────────────
  async submitLeg(input) {
    // Replace an existing draft leg in place; reject if there's already a
    // locked leg for this (parlay, user). Authorization lives in the
    // server action.
    const existing = await db
      .select()
      .from(parlayLegs)
      .where(
        and(
          eq(parlayLegs.parlayId, input.parlayId),
          eq(parlayLegs.userId, input.userId)
        )
      )
      .limit(1)

    if (existing[0] && existing[0].lockedAt) {
      throw new Error(
        `Leg is already locked for user ${input.userId} in parlay ${input.parlayId}.`
      )
    }

    const now = new Date()
    const payload = {
      parlayId: input.parlayId,
      userId: input.userId,
      description: input.description,
      odds: input.odds,
      lockedAt: now,
      validationStatus: input.validationStatus ?? null,
      validationMessage: input.validationMessage ?? null,
      updatedAt: now,
    }

    let saved
    if (existing[0]) {
      const [row] = await db
        .update(parlayLegs)
        .set(payload)
        .where(eq(parlayLegs.id, existing[0].id))
        .returning()
      saved = row!
    } else {
      const [row] = await db
        .insert(parlayLegs)
        .values({ ...payload, legNumber: 0 })
        .returning()
      saved = row!
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, saved.userId))
      .limit(1)
    return parlayLegFromRow(saved, userFromRow(user[0]!))
  },

  async deleteLeg(legId) {
    await db.delete(parlayLegs).where(eq(parlayLegs.id, legId))
  },

  async updateLegResult(legId, result) {
    const [row] = await db
      .update(parlayLegs)
      .set({
        result,
        gradedAt: new Date(),
        gradedBy: 'manual',
      })
      .where(eq(parlayLegs.id, legId))
      .returning()
    if (!row) throw new Error(`Leg ${legId} not found`)
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1)
    return parlayLegFromRow(row, userFromRow(user[0]!))
  },

  // ─── Charter ───────────────────────────────────────────────────────────
  async getCharter(leagueId, season) {
    return loadCharter(leagueId, season)
  },

  async seedCharterForLeague(leagueId, season, viewerId) {
    const existing = await db
      .select({ id: charterEntries.id })
      .from(charterEntries)
      .where(
        and(eq(charterEntries.leagueId, leagueId), eq(charterEntries.season, season))
      )
      .limit(1)
    if (existing.length > 0) return

    // Seed polls first so we can resolve each template's mock pollId
    // (e.g. 'tie-breaker') to the actual polls.id UUID.
    const pollIdByTemplateKey = await this.seedPollsForLeague(leagueId, viewerId)

    type SeedRow = {
      leagueId: string
      season: string
      key: string
      label: string
      category: CharterCategory
      description: string | null
      source: 'manual' | 'derived-from-poll'
      pollId: string | null
      approvalRule: CharterApprovalRule
      threshold: number | null
      status: CharterStatus
      value: string | null
      lockedAt: Date | null
      proposedBy: string
    }
    const rows: SeedRow[] = STANDARD_CHARTER_TEMPLATES.map((tpl) => {
      const hasLockedValue = !!tpl.manualValue && tpl.lockedDaysAgo != null
      const realPollId = tpl.pollId ? pollIdByTemplateKey.get(tpl.pollId) ?? null : null
      return {
        leagueId,
        season,
        key: tpl.key,
        label: tpl.label,
        category: tpl.category,
        description: tpl.description ?? null,
        source: realPollId ? 'derived-from-poll' : 'manual',
        pollId: realPollId,
        approvalRule: tpl.approvalRule,
        threshold: tpl.threshold ?? null,
        status: hasLockedValue ? 'locked' : 'draft',
        value: hasLockedValue ? tpl.manualValue! : null,
        lockedAt: hasLockedValue
          ? new Date(Date.now() - tpl.lockedDaysAgo! * 86400_000)
          : null,
        proposedBy: viewerId,
      }
    })

    await db.insert(charterEntries).values(rows).onConflictDoNothing()
  },

  async seedPollsForLeague(leagueId, viewerId) {
    // Pre-fetch any existing seeded polls for this league so we can
    // return a complete map without re-inserting.
    const existing = await db
      .select({ id: polls.id, templateKey: polls.templateKey })
      .from(polls)
      .where(eq(polls.leagueId, leagueId))
    const idByKey = new Map<string, string>()
    for (const r of existing) {
      if (r.templateKey) idByKey.set(r.templateKey, r.id)
    }

    // Figure out which templates haven't been seeded yet.
    const toSeed = STANDARD_POLL_TEMPLATES.filter((tpl) => !idByKey.has(tpl.id))
    if (toSeed.length === 0) return idByKey

    // Insert each missing template as an *open* poll for this league.
    // No vote synthesis — real leagues collect real votes.
    const pollRows = toSeed.map((tpl) => ({
      leagueId,
      kind: tpl.kind,
      status: 'open' as const,
      title: tpl.title,
      prompt: tpl.prompt,
      topic: tpl.topic,
      optionPolicy: tpl.optionPolicy ?? ('closed' as const),
      isAnonymous: tpl.isAnonymous ?? false,
      maxRanks: tpl.maxRanks ?? null,
      parentPollId: null,
      templateKey: tpl.id,
      createdBy: viewerId,
      closesAt: tpl.closesInDays
        ? new Date(Date.now() + tpl.closesInDays * 86400_000)
        : null,
    }))
    const inserted = await db.insert(polls).values(pollRows).returning({
      id: polls.id,
      templateKey: polls.templateKey,
    })
    for (const r of inserted) {
      if (r.templateKey) idByKey.set(r.templateKey, r.id)
    }

    // Now insert each new poll's option rows.
    const optionRows: Array<{
      pollId: string
      label: string
      hint: string | null
      status: 'approved' | 'pending'
      addedBy: string
      sortOrder: number
    }> = []
    for (const tpl of toSeed) {
      const realId = idByKey.get(tpl.id)
      if (!realId) continue
      for (const [i, o] of (tpl.options ?? []).entries()) {
        optionRows.push({
          pollId: realId,
          label: o.label,
          hint: o.hint ?? null,
          status: 'approved',
          addedBy: viewerId,
          sortOrder: i,
        })
      }
      // Curated polls may also have member-pitched pending options.
      for (const [i, o] of (tpl.pendingOptions ?? []).entries()) {
        optionRows.push({
          pollId: realId,
          label: o.label,
          hint: o.hint ?? null,
          status: 'pending',
          addedBy: viewerId,
          sortOrder: 1000 + i,
        })
      }
    }
    if (optionRows.length > 0) {
      await db.insert(pollOptions).values(optionRows)
    }

    return idByKey
  },

  async proposeCharterEntry(entryId, userId, value) {
    await db
      .update(charterEntries)
      .set({
        pendingValue: value,
        proposedBy: userId,
        proposedAt: new Date(),
        status: 'pending',
      })
      .where(eq(charterEntries.id, entryId))
  },

  async approveCharterEntry(entryId, userId, approved) {
    await db
      .insert(charterApprovals)
      .values({ entryId, userId, approved })
      .onConflictDoUpdate({
        target: [charterApprovals.entryId, charterApprovals.userId],
        set: { approved, approvedAt: new Date() },
      })

    // Auto-lock when threshold met.
    const entry = await db
      .select()
      .from(charterEntries)
      .where(eq(charterEntries.id, entryId))
      .limit(1)
    if (!entry[0]) return
    if (entry[0].status !== 'pending' || !entry[0].pendingValue) return

    const [{ approvedCount }] = await db
      .select({ approvedCount: sql<number>`count(*)::int` })
      .from(charterApprovals)
      .where(
        and(
          eq(charterApprovals.entryId, entryId),
          eq(charterApprovals.approved, true)
        )
      )
    const [{ memberCount }] = await db
      .select({ memberCount: sql<number>`count(*)::int` })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, entry[0].leagueId))

    if (
      meetsThreshold(
        entry[0].approvalRule as CharterApprovalRule,
        entry[0].threshold,
        approvedCount ?? 0,
        memberCount ?? 0
      )
    ) {
      await db
        .update(charterEntries)
        .set({
          status: 'locked',
          value: entry[0].pendingValue,
          pendingValue: null,
          lockedAt: new Date(),
        })
        .where(eq(charterEntries.id, entryId))
    }
  },

  async createCharterEntry(input) {
    const [row] = await db
      .insert(charterEntries)
      .values({
        leagueId: input.leagueId,
        season: input.season,
        key: input.key,
        label: input.label,
        category: input.category,
        description: input.description ?? null,
        approvalRule: input.approvalRule,
        threshold: input.threshold ?? null,
        pollId: input.pollId ?? null,
        source: input.pollId ? 'derived-from-poll' : 'manual',
        status: 'draft',
        proposedBy: input.proposedBy,
        proposedAt: new Date(),
        metadata: input.metadata ?? null,
      })
      .returning()

    return {
      id: row!.id,
      key: row!.key,
      label: row!.label,
      category: row!.category as CharterCategory,
      value: row!.value,
      description: row!.description,
      season: row!.season,
      source: row!.source as CharterEntry['source'],
      pollId: row!.pollId,
      approvalRule: row!.approvalRule as CharterApprovalRule,
      threshold: row!.threshold,
      status: row!.status as CharterStatus,
      proposedBy: row!.proposedBy,
      proposedAt: row!.proposedAt?.toISOString() ?? null,
      lockedAt: row!.lockedAt?.toISOString() ?? null,
      pending: null,
      ...(row!.metadata ? { metadata: row!.metadata as CharterEntry['metadata'] } : {}),
    }
  },

  // ─── Polls ────────────────────────────────────────────────────────────
  async getPolls(leagueId, opts) {
    return loadPolls(leagueId, opts?.statuses ?? ['open', 'closed'])
  },

  async getPoll(pollId) {
    const row = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1)
    if (!row[0]) return null
    const list = await loadPolls(row[0].leagueId, [row[0].status as PollStatus])
    return list.find((p) => p.id === pollId) ?? null
  },

  async submitPollResponse(pollId, userId, vote) {
    if ('clear' in vote) {
      await db
        .delete(pollResponses)
        .where(
          and(eq(pollResponses.pollId, pollId), eq(pollResponses.userId, userId))
        )
      return
    }
    const selections =
      'choiceId' in vote
        ? [{ choiceId: vote.choiceId }]
        : 'choiceIds' in vote
          ? vote.choiceIds.map((id) => ({ choiceId: id }))
          : vote.rankings.map((r) => ({ choiceId: r.choiceId, rank: r.rank }))
    await db
      .insert(pollResponses)
      .values({ pollId, userId, selections, submittedAt: new Date() })
      .onConflictDoUpdate({
        target: [pollResponses.pollId, pollResponses.userId],
        set: { selections, submittedAt: new Date() },
      })
  },

  async addPollOption(pollId, userId, label) {
    const p = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1)
    if (!p[0]) throw new Error(`poll ${pollId} not found`)
    if (p[0].optionPolicy === 'closed') {
      throw new Error('Poll is closed to member option additions.')
    }
    const status = p[0].optionPolicy === 'open' ? 'approved' : 'pending'
    await db
      .insert(pollOptions)
      .values({ pollId, label, addedBy: userId, status, sortOrder: 999 })
  },

  async reactToPollOption(pollId, optionId, userId, value) {
    if (value === null) {
      await db
        .delete(pollOptionReactions)
        .where(
          and(
            eq(pollOptionReactions.pollId, pollId),
            eq(pollOptionReactions.optionId, optionId),
            eq(pollOptionReactions.userId, userId)
          )
        )
      return
    }
    await db
      .insert(pollOptionReactions)
      .values({ pollId, optionId, userId, value })
      .onConflictDoUpdate({
        target: [
          pollOptionReactions.pollId,
          pollOptionReactions.optionId,
          pollOptionReactions.userId,
        ],
        set: { value, reactedAt: new Date() },
      })
  },

  async createPoll(input) {
    const [pollRow] = await db
      .insert(polls)
      .values({
        leagueId: input.leagueId,
        kind: input.kind,
        title: input.title,
        prompt: input.prompt,
        topic: input.topic,
        optionPolicy: input.optionPolicy,
        isAnonymous: input.isAnonymous ?? false,
        maxRanks: input.maxRanks ?? null,
        parentPollId: input.parentPollId ?? null,
        createdBy: input.createdBy,
        status: 'open',
        closesAt: input.closesAt ?? null,
      })
      .returning()

    if (input.options.length > 0) {
      await db.insert(pollOptions).values(
        input.options.map((o, i) => ({
          pollId: pollRow!.id,
          label: o.label,
          hint: o.hint ?? null,
          status: 'approved' as const,
          addedBy: input.createdBy,
          sortOrder: i,
        }))
      )
    }

    const fetched = await this.getPoll(pollRow!.id)
    if (!fetched) throw new Error('createPoll: poll not found after insert')
    return fetched
  },

  async promotePollOption(pollId, optionId) {
    await db
      .update(pollOptions)
      .set({ status: 'approved' })
      .where(and(eq(pollOptions.pollId, pollId), eq(pollOptions.id, optionId)))
  },

  async closePoll(pollId) {
    await db
      .update(polls)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(polls.id, pollId))
  },

  async reopenPoll(pollId) {
    await db
      .update(polls)
      .set({ status: 'open', closedAt: null })
      .where(eq(polls.id, pollId))
  },

  async archivePoll(pollId) {
    await db
      .update(polls)
      .set({ status: 'archived', archivedAt: new Date() })
      .where(eq(polls.id, pollId))
  },
}

// ─── Helpers used by the adapter methods above ────────────────────────────

async function loadCharter(leagueId: string, season: string): Promise<CharterEntry[]> {
  const rows = await db
    .select()
    .from(charterEntries)
    .where(
      and(eq(charterEntries.leagueId, leagueId), eq(charterEntries.season, season))
    )

  if (rows.length === 0) return []

  // Fetch all approvals in one go.
  const entryIds = rows.map((r) => r.id)
  const approvals = await db
    .select()
    .from(charterApprovals)
    .where(inArray(charterApprovals.entryId, entryIds))

  const approvalsByEntry = new Map<string, typeof approvals>()
  for (const a of approvals) {
    const list = approvalsByEntry.get(a.entryId) ?? []
    list.push(a)
    approvalsByEntry.set(a.entryId, list)
  }

  return rows.map((r): CharterEntry => {
    const entryApprovals = approvalsByEntry.get(r.id) ?? []
    return {
      id: r.id,
      key: r.key,
      label: r.label,
      category: r.category as CharterCategory,
      value: r.value,
      description: r.description,
      season: r.season,
      source: r.source as CharterEntry['source'],
      pollId: r.pollId,
      approvalRule: r.approvalRule as CharterApprovalRule,
      threshold: r.threshold,
      status: r.status as CharterStatus,
      proposedBy: r.proposedBy,
      proposedAt: r.proposedAt?.toISOString() ?? null,
      lockedAt: r.lockedAt?.toISOString() ?? null,
      pending:
        r.status === 'pending' && r.pendingValue && r.proposedBy
          ? {
              value: r.pendingValue,
              proposedBy: r.proposedBy,
              proposedAt: r.proposedAt?.toISOString() ?? new Date().toISOString(),
              approvals: entryApprovals.map((a) => ({
                userId: a.userId,
                approved: a.approved,
                approvedAt: a.approvedAt.toISOString(),
              })),
            }
          : null,
      ...(r.metadata ? { metadata: r.metadata as CharterEntry['metadata'] } : {}),
    }
  })
}

// Approval-threshold check. Counts current approvals against the rule.
// Returns true if the entry should snap to 'locked'.
function meetsThreshold(
  rule: CharterApprovalRule,
  threshold: number | null,
  approvedCount: number,
  memberCount: number
): boolean {
  if (rule === 'commish') return false // commish flips manually
  if (rule === 'poll') return false // driven by poll close, not approvals
  if (rule === 'unanimous') return approvedCount >= memberCount
  if (rule === 'majority') return approvedCount >= Math.floor(memberCount / 2) + 1
  if (rule === 'supermajority') {
    const t = threshold ?? 0.75
    return approvedCount >= Math.ceil(memberCount * t)
  }
  return false
}

// ─── Polls ────────────────────────────────────────────────────────────────

async function loadPolls(
  leagueId: string,
  statuses: PollStatus[]
): Promise<LeaguePoll[]> {
  const pollRows = await db
    .select()
    .from(polls)
    .where(and(eq(polls.leagueId, leagueId), inArray(polls.status, statuses)))
    .orderBy(desc(polls.createdAt))
  if (pollRows.length === 0) return []

  const pollIds = pollRows.map((p) => p.id)
  const [optionRows, responseRows, reactionRows] = await Promise.all([
    db
      .select()
      .from(pollOptions)
      .where(inArray(pollOptions.pollId, pollIds))
      .orderBy(asc(pollOptions.sortOrder), asc(pollOptions.addedAt)),
    db.select().from(pollResponses).where(inArray(pollResponses.pollId, pollIds)),
    db
      .select()
      .from(pollOptionReactions)
      .where(inArray(pollOptionReactions.pollId, pollIds)),
  ])

  const optsByPoll = new Map<string, typeof optionRows>()
  for (const o of optionRows) {
    const list = optsByPoll.get(o.pollId) ?? []
    list.push(o)
    optsByPoll.set(o.pollId, list)
  }
  const respByPoll = new Map<string, typeof responseRows>()
  for (const r of responseRows) {
    const list = respByPoll.get(r.pollId) ?? []
    list.push(r)
    respByPoll.set(r.pollId, list)
  }
  const reactionsByPollOption = new Map<
    string,
    Array<{ userId: string; value: 1 | -1; at: string }>
  >()
  for (const r of reactionRows) {
    const key = `${r.pollId}::${r.optionId}`
    const list = reactionsByPollOption.get(key) ?? []
    list.push({
      userId: r.userId,
      value: r.value as 1 | -1,
      at: r.reactedAt.toISOString(),
    })
    reactionsByPollOption.set(key, list)
  }

  return pollRows.map((p): LeaguePoll => {
    const opts = optsByPoll.get(p.id) ?? []
    const responses = respByPoll.get(p.id) ?? []

    const toOption = (o: (typeof optionRows)[number]): PollOption => {
      const reactions = reactionsByPollOption.get(`${p.id}::${o.id}`) ?? []
      return {
        id: o.id,
        label: o.label,
        hint: o.hint ?? undefined,
        addedBy: o.addedBy ?? '',
        addedAt: o.addedAt.toISOString(),
        status: o.status as 'approved' | 'pending',
        reactions,
      }
    }

    const mappedResponses: PollResponse[] = responses.map((r) => {
      const sel = r.selections as
        | Array<{ choiceId?: string; text?: string; rank?: number }>
        | null
      const single = sel?.[0]?.choiceId ?? null
      const allChoiceIds = (sel ?? [])
        .filter((s) => s.choiceId)
        .map((s) => s.choiceId as string)
      const rankings = (sel ?? [])
        .filter((s) => s.choiceId && typeof s.rank === 'number')
        .map((s) => ({ choiceId: s.choiceId as string, rank: s.rank as number }))
      return {
        userId: r.userId,
        choiceId: single,
        choiceIds:
          p.kind === 'multi' && allChoiceIds.length > 0 ? allChoiceIds : null,
        text: sel?.[0]?.text ?? null,
        rankings: rankings.length > 0 ? rankings : null,
        submittedAt: r.submittedAt.toISOString(),
      }
    })

    return {
      id: p.id,
      kind: p.kind as PollKind,
      status: p.status as PollStatus,
      title: p.title,
      prompt: p.prompt,
      topic: p.topic as LeaguePoll['topic'],
      optionPolicy: p.optionPolicy as PollOptionPolicy,
      isAnonymous: p.isAnonymous,
      maxRanks: p.maxRanks,
      parentPollId: p.parentPollId,
      // LeaguePoll.options carries both approved + pending; consumers filter
      // by status. Pending lane lives in this same array.
      options: opts.map(toOption),
      responses: mappedResponses,
      createdBy: p.createdBy ?? '',
      createdAt: p.createdAt.toISOString(),
      closesAt: p.closesAt?.toISOString() ?? null,
      closedAt: p.closedAt?.toISOString() ?? null,
      archivedAt: p.archivedAt?.toISOString() ?? null,
    }
  })
}


// Suppress unused-import warning for LegResult — kept for type clarity in
// type aliases above.
void (null as LegResult | null)
void inArray
