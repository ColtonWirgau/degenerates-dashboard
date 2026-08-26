// Mock DataAdapter — synthesizes a complete, internally-consistent dataset
// per active scenario. Reads the active scenario from a cookie set by the
// dev toolbar; falls back to the default scenario when none is set.
//
// Data flow:
//   fixtures (real users, leagues, league_members) + leg-library (samples)
//   + scenario (now, currentSeason, weekState) → synthesized weeks + parlays
//
// Mutations (submitLeg, updateLegResult) live in a per-process Map keyed
// by scenarioId; they reset on dev-server reload, which is the right
// behavior for UI iteration.

import { type DataAdapter } from './adapter';
import { getActiveScenario } from './active-scenario';
import type {
  League,
  NflWeek,
  Parlay,
  ParlayLeg,
  ParlayState,
  LeaderboardEntry,
  UserSeasonStats,
  User,
  Role,
  SubmitLegInput,
  WeekKind,
  SeasonState,
} from './types';
import { type Scenario, SCENARIOS } from './scenarios';
import { pickLegSample } from './leg-library';

import rawProfiles from './fixtures/user_profiles.json';
import rawLeagues from './fixtures/leagues.json';
import rawMembers from './fixtures/league_members.json';

// ─── Fixture types (raw) ────────────────────────────────────────────────────
interface RawProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}
interface RawLeague {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  created_by: string | null;
}
interface RawMember {
  id: string;
  league_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

const PROFILES = rawProfiles as RawProfile[];
const LEAGUES_RAW = rawLeagues as RawLeague[];
const MEMBERS_RAW = rawMembers as RawMember[];

// ─── In-memory mutation overlay ─────────────────────────────────────────────
// Keyed by scenarioId so flipping scenarios doesn't bleed mutations
// across them. Per-process Maps — fine for dev server.
interface MutationOverlay {
  /** Map of `${parlayId}::${userId}` → leg overrides. */
  legs: Map<string, Partial<ParlayLeg> & { id?: string }>;
  /** Set of leg ids that were "deleted" (admin removed). */
  deletedLegIds: Set<string>;
}
const overlays = new Map<string, MutationOverlay>();
const overlayFor = (scenarioId: string): MutationOverlay => {
  let o = overlays.get(scenarioId);
  if (!o) {
    o = { legs: new Map(), deletedLegIds: new Set() };
    overlays.set(scenarioId, o);
  }
  return o;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const toUser = (p: RawProfile): User => ({
  id: p.id,
  email: p.email,
  fullName: p.full_name,
  avatarUrl: p.avatar_url,
});

const profileMap = new Map(PROFILES.map((p) => [p.id, toUser(p)]));

const NFL_WEEKS_PER_SEASON = 22; // 18 regular + 4 post-season

const weekKind = (weekNumber: number): WeekKind => {
  if (weekNumber <= 18) return 'regular';
  if (weekNumber === 19) return 'wildcard';
  if (weekNumber === 20) return 'divisional';
  if (weekNumber === 21) return 'conference';
  return 'super-bowl';
};

/**
 * Compute a deterministic week start date (Sunday 9:15 AM ET) for a season +
 * week number. Season `2026-2027` starts the first Sunday after Labor Day
 * (rough heuristic — close enough for mock data).
 */
const seasonOpener = (season: string): Date => {
  const startYear = parseInt(season.split('-')[0]!, 10);
  // Labor Day is the 1st Monday of September. The opener is the Thursday after.
  // For mocks: use the 2nd Sunday of September. Rough but consistent.
  const sept1 = new Date(Date.UTC(startYear, 8, 1));
  const dow = sept1.getUTCDay(); // 0=Sun..6=Sat
  const firstSunday = (7 - dow) % 7; // days to first Sunday
  const day = 1 + firstSunday + 7; // 2nd Sunday
  return new Date(Date.UTC(startYear, 8, day, 13, 15, 0)); // 9:15 ET ≈ 13:15 UTC
};

const weekDates = (season: string, weekNumber: number) => {
  const opener = seasonOpener(season);
  const start = new Date(opener);
  start.setUTCDate(opener.getUTCDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 2); // Tuesday roll-over
  end.setUTCHours(9); // ~5 AM ET
  return { startDate: start.toISOString(), endDate: end.toISOString() };
};

const buildWeeks = (season: string): NflWeek[] => {
  return Array.from({ length: NFL_WEEKS_PER_SEASON }, (_, i) => {
    const weekNumber = i + 1;
    const { startDate, endDate } = weekDates(season, weekNumber);
    return {
      id: `${season}-week-${weekNumber}`,
      weekNumber,
      season,
      startDate,
      endDate,
      kind: weekKind(weekNumber),
    };
  });
};

const americanOddsToDecimal = (american: number): number => {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
};

const decimalToAmerican = (decimal: number): string => {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
};

const computeTotalOdds = (legs: ParlayLeg[]): string | null => {
  if (legs.length === 0) return null;
  const product = legs.reduce((acc, l) => acc * americanOddsToDecimal(l.odds), 1);
  return decimalToAmerican(product);
};

/**
 * State semantics:
 *   - 'open' — submissions still being collected (member count > legs, or any
 *     leg still in draft).
 *   - 'locked' — every league member has submitted and locked, no results yet.
 *   - 'graded' — at least one result in, not all.
 *   - 'won' / 'lost' — every result in.
 *
 * `expectedMembers` is the league's member count. Without it, "locked" would
 * fire as soon as the *submitted* legs are all locked, even with members
 * still pending — which the week page used to work around manually.
 */
const computeParlayState = (
  legs: ParlayLeg[],
  expectedMembers: number
): { state: ParlayState; result: 'won' | 'lost' | null } => {
  if (legs.length === 0) return { state: 'open', result: null };
  const anyDraft = legs.some((l) => l.lockedAt === null);
  if (anyDraft || legs.length < expectedMembers) {
    return { state: 'open', result: null };
  }
  const anyResult = legs.some((l) => l.result !== null);
  if (!anyResult) return { state: 'locked', result: null };
  const allGraded = legs.every((l) => l.result !== null);
  if (!allGraded) return { state: 'graded', result: null };
  const anyLoss = legs.some((l) => l.result === 'loss');
  if (anyLoss) return { state: 'lost', result: 'lost' };
  // pushes don't lose; treat as won if no losses
  return { state: 'won', result: 'won' };
};

// ─── Synthesis ──────────────────────────────────────────────────────────────

interface SynthesizedStore {
  scenario: Scenario;
  now: Date;
  users: User[];
  leagues: League[];
  members: { leagueId: string; user: User; role: Role; joinedAt: string }[];
  weeks: NflWeek[];
  parlays: Parlay[];
}

let cachedStore: { scenarioId: string; store: SynthesizedStore } | null = null;

const synthesize = (scenario: Scenario): SynthesizedStore => {
  if (cachedStore && cachedStore.scenarioId === scenario.id) return cachedStore.store;

  const now = new Date(scenario.now);

  const users = PROFILES.map(toUser);
  const leagues: League[] = LEAGUES_RAW.map((l) => ({
    id: l.id,
    name: l.name,
    inviteCode: l.invite_code,
    createdAt: l.created_at,
    createdBy: l.created_by ?? users[0]!.id,
  }));
  const members = MEMBERS_RAW.map((m) => ({
    leagueId: m.league_id,
    user: profileMap.get(m.user_id)!,
    role: m.role as Role,
    joinedAt: m.joined_at,
  })).filter((m) => m.user); // drop dangling refs

  const weeks = buildWeeks(scenario.currentSeason);

  // Determine the active week index based on scenario.now or forceWeekNumber
  const activeWeekIdx = scenario.forceWeekNumber
    ? scenario.forceWeekNumber - 1
    : weeks.findIndex(
        (w) => new Date(w.endDate!) >= now && new Date(w.startDate!) <= addDays(now, 7)
      );

  const overlay = overlayFor(scenario.id);

  // Build parlays for each league × week
  const parlays: Parlay[] = [];
  for (const league of leagues) {
    const leagueMembers = members.filter((m) => m.leagueId === league.id);
    if (leagueMembers.length === 0) continue;

    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i]!;
      const isActive = activeWeekIdx >= 0 && i === activeWeekIdx;
      const isPast = activeWeekIdx >= 0 ? i < activeWeekIdx : new Date(week.endDate!) < now;
      const isFuture = !isActive && !isPast;

      // Future weeks: no parlay row at all (mirrors how the league hasn't
      // opened the week yet). Caller will see null and render a placeholder.
      if (isFuture) continue;

      // The "graded" override marks the active week as already played →
      // every leg gets a result and a leg-number, same as a past week.
      const isGradedActive = isActive && scenario.weekState?.graded === true;
      const treatAsPast = isPast || isGradedActive;
      // Live-games-in-progress: a fraction of submitted legs are settled,
      // the rest stay pending. Settled legs default to wins so the parlay
      // is still alive (any loss = bust).
      const gradedRatio =
        isActive && !isGradedActive && scenario.weekState?.gradedRatio
          ? Math.max(0, Math.min(1, scenario.weekState.gradedRatio))
          : 0;

      const parlayId = `${league.id}::${week.id}`;
      const legs: ParlayLeg[] = [];

      // Decide who's submitted for this parlay
      let submittedRatio: number;
      if (treatAsPast) submittedRatio = 1;
      else submittedRatio = scenario.weekState?.submittedRatio ?? 1;

      const submittedCount = Math.round(leagueMembers.length * submittedRatio);
      const sortedMembers = [...leagueMembers].sort((a, b) =>
        a.user.id.localeCompare(b.user.id)
      );
      const submitters = sortedMembers.slice(0, submittedCount);

      const liveSettledCount = Math.floor(submitters.length * gradedRatio);

      submitters.forEach((m, idx) => {
        const overlayKey = `${parlayId}::${m.user.id}`;
        const override = overlay.legs.get(overlayKey);
        if (override?.id && overlay.deletedLegIds.has(override.id)) return;

        const sample = pickLegSample(`${overlayKey}-${scenario.id}`);
        // Live-mode: the first N legs are settled (default win, parlay
        // alive), the rest are still in flight.
        const isSettledLive = gradedRatio > 0 && idx < liveSettledCount;
        const baseLeg: ParlayLeg = {
          id: override?.id ?? `${overlayKey}-leg`,
          parlayId,
          user: m.user,
          legNumber: treatAsPast || isSettledLive ? idx + 1 : 0,
          description: sample.description,
          odds: sample.odds,
          result: treatAsPast
            ? sampleResult(`${overlayKey}-result`)
            : isSettledLive
              ? 'win'
              : null,
          lockedAt: deriveLockedAt(scenario, week, m.user.id, treatAsPast || gradedRatio > 0),
          createdAt: weeks[i]!.startDate ?? new Date().toISOString(),
          recordOnly: false,
          nflGameId: null,
          validationStatus: 'approved',
          validationMessage: 'Valid',
        };
        legs.push({ ...baseLeg, ...override });
      });

      // Inject any user-added (overlay) legs that weren't in the auto-population
      for (const [key, override] of overlay.legs) {
        if (!key.startsWith(`${parlayId}::`)) continue;
        const userId = key.split('::')[2]!;
        if (legs.some((l) => l.user.id === userId)) continue;
        if (override.id && overlay.deletedLegIds.has(override.id)) continue;
        const user = profileMap.get(userId);
        if (!user) continue;
        const sample = pickLegSample(`${key}-${scenario.id}`);
        legs.push({
          id: override.id ?? `${key}-leg`,
          parlayId,
          user,
          legNumber: 0,
          description: override.description ?? sample.description,
          odds: override.odds ?? sample.odds,
          result: override.result ?? null,
          lockedAt: override.lockedAt ?? null,
          createdAt: new Date().toISOString(),
          recordOnly: false,
          nflGameId: null,
          validationStatus: override.validationStatus ?? 'approved',
          validationMessage: override.validationMessage ?? 'Valid',
        });
      }

      const totalOdds = treatAsPast ? computeTotalOdds(legs) : null;
      const stateInfo = computeParlayState(legs, leagueMembers.length);

      parlays.push({
        id: parlayId,
        leagueId: league.id,
        week,
        legs,
        totalOdds,
        state: stateInfo.state,
        result: stateInfo.result,
        // Past weeks lock at their start; open/future weeks stay null so the
        // fixture clock (scenario "now" vs real now) can't spuriously lock
        // submissions. Deadline displays fall back to week.startDate.
        lockAt: treatAsPast ? week.startDate ?? null : null,
      });
    }
  }

  // Also build a fully-played PREVIOUS season so offseason / preseason
  // scenarios have a real "Final Standings" recap to render. Same fixtures,
  // every member submits, every leg has a result, regular-season only.
  const prevSeason = (() => {
    const startYear = parseInt(scenario.currentSeason.split('-')[0]!, 10);
    return `${startYear - 1}-${startYear}`;
  })();
  const prevWeeks = buildWeeks(prevSeason).filter((w) => w.kind === 'regular');
  for (const league of leagues) {
    const leagueMembers = members.filter((m) => m.leagueId === league.id);
    if (leagueMembers.length === 0) continue;

    for (const week of prevWeeks) {
      const parlayId = `${league.id}::${week.id}`;
      const legs: ParlayLeg[] = [];
      const sortedMembers = [...leagueMembers].sort((a, b) =>
        a.user.id.localeCompare(b.user.id)
      );
      sortedMembers.forEach((m, idx) => {
        const overlayKey = `${parlayId}::${m.user.id}`;
        const sample = pickLegSample(`${overlayKey}-${scenario.id}-prev`);
        legs.push({
          id: `${overlayKey}-leg`,
          parlayId,
          user: m.user,
          legNumber: idx + 1,
          description: sample.description,
          odds: sample.odds,
          result: sampleResult(`${overlayKey}-prev-result`),
          lockedAt: week.startDate,
          createdAt: week.startDate ?? new Date().toISOString(),
          recordOnly: false,
          nflGameId: null,
          validationStatus: 'approved',
          validationMessage: 'Valid',
        });
      });

      const totalOdds = computeTotalOdds(legs);
      const stateInfo = computeParlayState(legs, leagueMembers.length);
      parlays.push({
        id: parlayId,
        leagueId: league.id,
        week,
        legs,
        totalOdds,
        state: stateInfo.state,
        result: stateInfo.result,
        lockAt: week.startDate ?? null,
      });
    }
  }

  const store: SynthesizedStore = { scenario, now, users, leagues, members, weeks, parlays };
  cachedStore = { scenarioId: scenario.id, store };
  return store;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setUTCDate(d.getUTCDate() + n);
  return r;
};

/** Deterministic win/loss/push picker — biased toward losses since real-life
 *  parlays usually lose. Pushes are rare. */
const sampleResult = (seed: string): 'win' | 'loss' | 'push' => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const v = Math.abs(h) % 100;
  if (v < 50) return 'win';
  if (v < 95) return 'loss';
  return 'push';
};

const seasonStateFromActiveWeek = (
  active: NflWeek,
  weeks: NflWeek[]
): SeasonState => {
  const now = new Date();
  const isLive =
    !!active.startDate &&
    !!active.endDate &&
    new Date(active.startDate) <= now &&
    new Date(active.endDate) >= now;

  if (active.kind === 'super-bowl') {
    return { kind: 'super-bowl', activeWeek: active };
  }
  if (active.kind === 'wildcard' || active.kind === 'divisional' || active.kind === 'conference') {
    const labels: Record<string, string> = {
      wildcard: 'Wildcard Weekend',
      divisional: 'Divisional Round',
      conference: 'Conference Championships',
    };
    return {
      kind: 'playoffs',
      activeWeek: active,
      roundLabel: labels[active.kind]!,
    };
  }
  // Regular season
  const regularWeeks = weeks.filter((w) => w.kind === 'regular');
  const idx = regularWeeks.findIndex((w) => w.id === active.id);
  const weeksRemaining = idx >= 0 ? Math.max(0, regularWeeks.length - 1 - idx) : 0;
  const next = isLive ? null : active;
  return {
    kind: 'regular-season',
    activeWeek: active,
    weeksRemaining,
    isLive,
    nextWeek: next && !isLive ? next : null,
  };
};

const deriveLockedAt = (
  scenario: Scenario,
  week: NflWeek,
  userId: string,
  isPast: boolean
): string | null => {
  if (isPast) return week.startDate;
  if (scenario.weekState?.locked === false) return null;
  // For active weeks: stagger lock times so the UI shows a realistic mix
  // (some users locked in days early, some last-minute).
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h << 5) - h + userId.charCodeAt(i);
  const hoursBack = Math.abs(h) % 48; // 0–48 hours before week.startDate
  if (!week.startDate) return null;
  return new Date(new Date(week.startDate).getTime() - hoursBack * 3600 * 1000).toISOString();
};

// ─── Adapter implementation ─────────────────────────────────────────────────

async function store(): Promise<SynthesizedStore> {
  return synthesize(await getActiveScenario());
}

export const mockAdapter: DataAdapter = {
  async getLeaguesForUser(userId) {
    const s = await store();
    const leagueIds = new Set(
      s.members.filter((m) => m.user.id === userId).map((m) => m.leagueId)
    );
    return s.leagues.filter((l) => leagueIds.has(l.id));
  },

  async getLeague(leagueId, userId) {
    const s = await store();
    const isMember = s.members.some(
      (m) => m.leagueId === leagueId && m.user.id === userId
    );
    if (!isMember) return null;
    return s.leagues.find((l) => l.id === leagueId) ?? null;
  },

  async getLeagueMembers(leagueId) {
    const s = await store();
    return s.members
      .filter((m) => m.leagueId === leagueId)
      .map(({ user, role, joinedAt }) => ({ user, role, joinedAt }));
  },

  async getUserRole(leagueId, userId) {
    const s = await store();
    const m = s.members.find(
      (m) => m.leagueId === leagueId && m.user.id === userId
    );
    return m?.role ?? null;
  },

  async getWeeksForSeason(season) {
    const s = await store();
    if (s.scenario.currentSeason === season) return s.weeks;
    return buildWeeks(season);
  },

  async getCurrentWeek(season) {
    const s = await store();
    if (s.scenario.currentSeason !== season) return null;

    if (s.scenario.forceWeekNumber) {
      return s.weeks.find((w) => w.weekNumber === s.scenario.forceWeekNumber) ?? null;
    }
    const now = s.now;
    const active = s.weeks.find(
      (w) => new Date(w.startDate!) <= now && new Date(w.endDate!) >= now
    );
    if (active) return active;
    // Between weeks: surface the upcoming one (Tuesday → Saturday gap)
    const upcoming = s.weeks.find((w) => new Date(w.startDate!) > now);
    return upcoming ?? null;
  },

  async getSeasonState() {
    const s = await store();
    const { weeks, now, scenario } = s;
    const firstWeek = weeks[0]!;
    const lastRegularWeek = weeks.find((w) => w.weekNumber === 18) ?? weeks[17] ?? weeks[weeks.length - 1]!;
    const lastWeek = weeks[weeks.length - 1]!;

    // Forced week → derive state from the forced week's kind.
    if (scenario.forceWeekNumber) {
      const week = weeks.find((w) => w.weekNumber === scenario.forceWeekNumber)!;
      return seasonStateFromActiveWeek(week, weeks);
    }

    // No-force: classify by where `now` falls relative to the season.
    const beforeFirst = now < new Date(firstWeek.startDate!);
    const afterLast = now > new Date(lastWeek.endDate!);

    if (beforeFirst) {
      const daysUntilKickoff = Math.ceil(
        (new Date(firstWeek.startDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Offseason vs preseason cutoff: 60 days. Within 60 days of kickoff,
      // the schedule has typically been released and we shift into preseason
      // mode (banners change, schedule preview becomes available).
      if (daysUntilKickoff > 60) {
        const startYear = parseInt(scenario.currentSeason.split('-')[0]!, 10);
        return {
          kind: 'offseason',
          lastSeason: `${startYear - 1}-${startYear}`,
          nextSeason: scenario.currentSeason,
          // Schedule typically drops in mid-May for the upcoming season —
          // null this out for "deep" offseason scenarios where it's unknown.
          expectedKickoff: daysUntilKickoff > 120 ? null : firstWeek.startDate,
        };
      }
      return {
        kind: 'preseason',
        nextKickoff: firstWeek.startDate!,
        daysUntilKickoff,
        currentSeason: scenario.currentSeason,
      };
    }

    if (afterLast) {
      const startYear = parseInt(scenario.currentSeason.split('-')[0]!, 10);
      return {
        kind: 'offseason',
        lastSeason: scenario.currentSeason,
        nextSeason: `${startYear + 1}-${startYear + 2}`,
        expectedKickoff: null,
      };
    }

    // Find the active or next week
    const active = weeks.find(
      (w) => new Date(w.startDate!) <= now && new Date(w.endDate!) >= now
    );
    if (active) return seasonStateFromActiveWeek(active, weeks);
    const next = weeks.find((w) => new Date(w.startDate!) > now);
    if (next) return seasonStateFromActiveWeek(next, weeks);

    // Should be unreachable given the bounds checks above
    return seasonStateFromActiveWeek(lastRegularWeek, weeks);
  },

  async getWeekParlay(leagueId, weekId) {
    const s = await store();
    return s.parlays.find((p) => p.leagueId === leagueId && p.week.id === weekId) ?? null;
  },

  // Mock fixtures are synthesized per scenario — nothing to create. Delegates
  // so the shared "ensure" call sites work in both modes.
  async ensureWeekParlay(leagueId, nflWeekId) {
    return this.getWeekParlay(leagueId, nflWeekId);
  },

  async getParlay(parlayId) {
    const s = await store();
    return s.parlays.find((p) => p.id === parlayId) ?? null;
  },

  async getLeagueParlays(leagueId, season) {
    const s = await store();
    return s.parlays
      .filter((p) => p.leagueId === leagueId && p.week.season === season)
      .sort((a, b) => a.week.weekNumber - b.week.weekNumber);
  },

  async getLeaderboard(leagueId, season) {
    const s = await store();
    const members = s.members.filter((m) => m.leagueId === leagueId);
    const parlays = s.parlays.filter(
      (p) => p.leagueId === leagueId && p.week.season === season
    );
    const stats = new Map<string, UserSeasonStats & { user: User }>();
    for (const m of members) {
      stats.set(m.user.id, {
        userId: m.user.id,
        user: m.user,
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        total: 0,
        winRate: 0,
      });
    }
    for (const p of parlays) {
      for (const leg of p.legs) {
        const entry = stats.get(leg.user.id);
        if (!entry) continue;
        entry.total++;
        if (leg.result === 'win') entry.wins++;
        else if (leg.result === 'loss') entry.losses++;
        else if (leg.result === 'push') entry.pushes++;
        else entry.pending++;
      }
    }
    const out: LeaderboardEntry[] = [];
    for (const e of stats.values()) {
      const decided = e.wins + e.losses;
      e.winRate = decided ? (e.wins / decided) * 100 : 0;
      out.push(e);
    }
    return out.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  },

  async getUserStats(leagueId, userId, season) {
    const board = await this.getLeaderboard(leagueId, season);
    return (
      board.find((e) => e.userId === userId) ?? {
        userId,
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        total: 0,
        winRate: 0,
      }
    );
  },

  // ─── Mutations ──────────────────────────────────────────────────────────
  async submitLeg(input: SubmitLegInput) {
    const s = await store();
    const overlay = overlayFor(s.scenario.id);
    const key = `${input.parlayId}::${input.userId}`;

    // Allow overwriting your own leg as long as the parlay is still open.
    // The parlay locks (state !== 'open') once everyone is in OR the
    // deadline elapses; from that point on the leg is final.
    const parlay = s.parlays.find((p) => p.id === input.parlayId);
    const existing = parlay?.legs.find((l) => l.user.id === input.userId);
    if (parlay && parlay.state !== 'open') {
      throw new Error(
        'The parlay is locked for the week — your leg can no longer be edited.'
      );
    }

    const id = existing?.id ?? `${key}-leg`;
    const user = profileMap.get(input.userId)!;
    const leg: ParlayLeg = {
      id,
      parlayId: input.parlayId,
      user,
      legNumber: existing?.legNumber ?? 0,
      description: input.description,
      odds: input.odds,
      result: null,
      lockedAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      recordOnly: false,
      nflGameId: null,
      validationStatus: input.validationStatus ?? 'approved',
      validationMessage: input.validationMessage ?? 'Valid',
    };
    overlay.legs.set(key, { ...leg });
    overlay.deletedLegIds.delete(id);
    cachedStore = null; // bust cache so the next read re-synthesizes
    return leg;
  },

  async deleteLeg(legId) {
    const s = await store();
    const overlay = overlayFor(s.scenario.id);
    const target = s.parlays.flatMap((p) => p.legs).find((l) => l.id === legId);
    if (!target) return;
    const key = `${target.parlayId}::${target.user.id}`;
    overlay.deletedLegIds.add(target.id);
    overlay.legs.delete(key);
    cachedStore = null;
  },

  async updateLegResult(legId, result) {
    const s = await store();
    const overlay = overlayFor(s.scenario.id);
    // Find the leg in synthesized output, copy override
    const target = s.parlays.flatMap((p) => p.legs).find((l) => l.id === legId);
    if (!target) throw new Error(`leg ${legId} not found`);
    const key = `${target.parlayId}::${target.user.id}`;
    overlay.legs.set(key, { ...target, result });
    cachedStore = null;
    return { ...target, result };
  },

  // ─── Charter + Polls — stubs in mock mode ─────────────────────────────
  // Server actions still call generateMockCharter / generateMockPolls
  // directly in mock mode; these adapter methods are only invoked under
  // NEXT_PUBLIC_DATA_SOURCE=neon. Throw clearly if they're hit.
  async getCharter() {
    throw new Error('mock-adapter.getCharter: use generateMockCharter directly in mock mode')
  },
  async seedCharterForLeague() {
    /* no-op in mock — generators create entries on the fly */
  },
  async seedPollsForLeague() {
    /* no-op in mock — generators create polls on the fly */
    return new Map<string, string>()
  },
  async proposeCharterEntry() {
    /* no-op in mock — session state in offseason-polls-hub.tsx owns it */
  },
  async approveCharterEntry() {
    /* no-op in mock */
  },
  async createCharterEntry() {
    throw new Error('mock-adapter.createCharterEntry: not implemented in mock mode')
  },
  async getKeepers() {
    throw new Error('mock-adapter.getKeepers: not implemented in mock mode')
  },
  async upsertKeeper() {
    throw new Error('mock-adapter.upsertKeeper: not implemented in mock mode')
  },
  async deleteKeeper() {
    throw new Error('mock-adapter.deleteKeeper: not implemented in mock mode')
  },
  async updateCharterEntry() {
    throw new Error('mock-adapter.updateCharterEntry: not implemented in mock mode')
  },
  async deleteCharterEntry() {
    throw new Error('mock-adapter.deleteCharterEntry: not implemented in mock mode')
  },
  async getPolls() {
    throw new Error('mock-adapter.getPolls: use generateMockPolls directly in mock mode')
  },
  async getPoll() {
    throw new Error('mock-adapter.getPoll: not implemented in mock mode')
  },
  async submitPollResponse() {
    /* no-op in mock — session state owns it */
  },
  async addPollOption() {
    /* no-op in mock */
  },
  async reactToPollOption() {
    /* no-op in mock */
  },
  async createPoll() {
    throw new Error('mock-adapter.createPoll: not implemented in mock mode')
  },
  async promotePollOption() {
    /* no-op in mock */
  },
  async closePoll() {
    /* no-op in mock */
  },
  async reopenPoll() {
    /* no-op in mock */
  },
  async archivePoll() {
    /* no-op in mock */
  },
  async deletePoll() {
    /* no-op in mock */
  },
};

// Exposed for the dev toolbar so it can label the current scenario without
// duplicating cookie-reading logic.
export { SCENARIOS };
