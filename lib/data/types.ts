// Domain types — backend-agnostic. Both the mock adapter and the eventual
// Neon adapter return data in these shapes.

export type Role = 'owner' | 'admin' | 'member';

export type LegResult = 'win' | 'loss' | 'push' | null;

export type WeekKind =
  | 'preseason' // week 0 — no games; the league's own business
  | 'regular' // weeks 1–18
  | 'wildcard' // post-season round 1 (week 19)
  | 'divisional' // round 2 (week 20)
  | 'conference' // round 3 (week 21)
  | 'super-bowl'; // week 22 (with bye)

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface LeagueMember {
  user: User;
  role: Role;
  joinedAt: string;
}

export interface League {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  createdBy: string;
}

export interface NflWeek {
  id: string;
  weekNumber: number;
  season: string; // e.g. '2025-2026'
  /** First-game kickoff (server-stored, ET wall-clock) */
  startDate: string | null;
  /** Tuesday morning roll-over after MNF */
  endDate: string | null;
  kind: WeekKind;
}

export interface ParlayLeg {
  id: string;
  parlayId: string;
  user: User;
  /** Position in the assembled parlay. 0 = unassigned. */
  legNumber: number;
  description: string;
  odds: number; // American odds, e.g. -110, +145
  /**
   * The RESULT is real and the rest of this leg isn't: it came from the
   * two seasons the league scored in a shared note, which only ever kept
   * the current week's table. The wins and losses imported exactly; the
   * wording was already gone. Never show the description or the odds of
   * one of these as a bet somebody placed.
   */
  recordOnly: boolean;
  /** The game it's on, once anything knows. Null while unknown, and
   *  permanently null for a bet spanning two games. */
  nflGameId: string | null;
  result: LegResult;
  /** Null = draft (editable). Non-null = locked, immutable. */
  lockedAt: string | null;
  createdAt: string;
  /** AI validation outcome (null = not yet validated) */
  validationStatus: 'approved' | 'conflicting' | null;
  validationMessage: string | null;
}

/** A league's parlay for one NFL week. Each member contributes one leg. */
export interface Parlay {
  id: string;
  leagueId: string;
  week: NflWeek;
  legs: ParlayLeg[];
  /** Combined American odds string (e.g. '+12500'), null until computed */
  totalOdds: string | null;
  /** Derived: 'open' = legs editable, 'locked' = all legs locked, no results yet,
   *  'graded' = at least one leg has a result, 'won'/'lost' = fully graded. */
  state: ParlayState;
  /** Convenience: outcome when state==='won'|'lost' */
  result: 'won' | 'lost' | null;
  /** The moment submissions lock — earliest in-slate kickoff minus the
   *  league's lock offset (league_weeks.lock_at_cached). Null = TBD
   *  (no in-slate games, e.g. flex/postseason mismatch). */
  lockAt: string | null;
}

export type ParlayState = 'open' | 'locked' | 'graded' | 'won' | 'lost';

/** Where in the season cycle the league is, for top-level UI branching. */
export type SeasonState =
  | {
      kind: 'offseason';
      /** Most recent completed season, e.g. '2025-2026'. Null if first season. */
      lastSeason: string | null;
      /** The upcoming season, e.g. '2026-2027'. */
      nextSeason: string;
      /** ISO date when the next season's first week is expected to kick off,
       *  if known. Null when the schedule hasn't been released yet. */
      expectedKickoff: string | null;
    }
  | {
      kind: 'preseason';
      /** First-game kickoff of the upcoming regular season. */
      nextKickoff: string;
      daysUntilKickoff: number;
      currentSeason: string;
    }
  | {
      kind: 'regular-season';
      activeWeek: NflWeek;
      weeksRemaining: number;
      /** Whether `activeWeek` is currently between kickoff and Tuesday roll-over. */
      isLive: boolean;
      /** When kind is 'regular-season' but no week is currently in flight
       *  (e.g. Tuesday-Thursday gap), the next upcoming week. */
      nextWeek: NflWeek | null;
    }
  | {
      kind: 'playoffs';
      activeWeek: NflWeek;
      /** Friendly label like 'Wildcard Weekend' / 'Divisional Round' / etc. */
      roundLabel: string;
    }
  | {
      kind: 'super-bowl';
      activeWeek: NflWeek;
    };

/** Aggregate stats for a user inside a league for a given season window. */
export interface UserSeasonStats {
  userId: string;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  total: number;
  winRate: number; // 0–100
}

/** A row on the leaderboard. */
export interface LeaderboardEntry extends UserSeasonStats {
  user: User;
}

// ─── Inputs for mutations ────────────────────────────────────────────────────

export interface SubmitLegInput {
  parlayId: string;
  userId: string;
  description: string;
  odds: number;
  /** Which game the bet is on. Null when the bettor didn't say, or when
   *  it genuinely isn't one game (a two-game total, a cross-game combo). */
  nflGameId?: string | null;
  /** Optional validation outcome to persist alongside the leg. Set by the
   *  server action after running AI validation; the adapter just stores. */
  validationStatus?: 'approved' | 'conflicting';
  validationMessage?: string;
}
