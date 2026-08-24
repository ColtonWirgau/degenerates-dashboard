// DataAdapter — the seam between UI and storage. Two impls:
//   • mock-adapter: in-memory fixtures + scenario switching (UI iteration)
//   • neon-adapter: direct postgres / drizzle against Neon (production)
//
// All methods are async even when an impl is sync, so the contract stays
// uniform.

import type {
  League,
  LeagueMember,
  NflWeek,
  Parlay,
  ParlayLeg,
  LeaderboardEntry,
  UserSeasonStats,
  SubmitLegInput,
  Role,
  SeasonState,
} from './types';
import type { CharterEntry, CharterApprovalRule, CharterCategory } from './mock-charter';
import type {
  LeaguePoll,
  PollKind,
  PollStatus,
  PollOptionPolicy,
  RankedSelection,
} from './mock-polls';

export interface DataAdapter {
  // ─── Leagues / membership ───────────────────────────────────────────────
  /** All leagues the given user is a member of, newest first. */
  getLeaguesForUser(userId: string): Promise<League[]>;
  /** Single league, or null if not found / user lacks access. */
  getLeague(leagueId: string, userId: string): Promise<League | null>;
  /** All members of a league with their user info. */
  getLeagueMembers(leagueId: string): Promise<LeagueMember[]>;
  /** Caller's role in a league, or null if not a member. */
  getUserRole(leagueId: string, userId: string): Promise<Role | null>;

  // ─── Weeks ──────────────────────────────────────────────────────────────
  /** All weeks for a season (regular + post-season). */
  getWeeksForSeason(season: string): Promise<NflWeek[]>;
  /** The "current" week — based on the adapter's notion of `now`. Mock can
   *  override for scenario testing. */
  getCurrentWeek(season: string): Promise<NflWeek | null>;
  /** Where in the season cycle the league is right now — drives top-level
   *  UI branching (offseason banners, playoff hero, super-bowl single-game). */
  getSeasonState(): Promise<SeasonState>;

  // ─── Parlays ────────────────────────────────────────────────────────────
  /** League's parlay for a specific week, with all legs + users + state. */
  getWeekParlay(leagueId: string, weekId: string): Promise<Parlay | null>;
  /** Get the league's parlay for an NFL week, creating the row if absent.
   *  Race-safe via the (league_id, nfl_week_id) unique constraint. Returns
   *  null only in mock mode when the fixture week has no parlay. */
  ensureWeekParlay(leagueId: string, nflWeekId: string): Promise<Parlay | null>;
  /** Parlay by id (URL convenience). */
  getParlay(parlayId: string): Promise<Parlay | null>;
  /** All parlays for a league across a season, oldest → newest. */
  getLeagueParlays(leagueId: string, season: string): Promise<Parlay[]>;

  // ─── Stats ──────────────────────────────────────────────────────────────
  getLeaderboard(leagueId: string, season: string): Promise<LeaderboardEntry[]>;
  getUserStats(leagueId: string, userId: string, season: string): Promise<UserSeasonStats>;

  // ─── Mutations ──────────────────────────────────────────────────────────
  /** Submit (lock) a user's leg. Errors if the user already has a *locked*
   *  leg in this parlay — to change it, the user (or an admin) deletes
   *  first, then resubmits. Replaces an existing draft leg in place. */
  submitLeg(input: SubmitLegInput): Promise<ParlayLeg>;
  /** Delete a leg by id. The user themselves can delete their own leg
   *  while it's still draft; admins can delete any leg at any state.
   *  Authorization is enforced by the server action, not the adapter. */
  deleteLeg(legId: string): Promise<void>;
  /** Admin-only: set a leg's result. */
  updateLegResult(legId: string, result: 'win' | 'loss' | 'push'): Promise<ParlayLeg>;

  // ─── Charter ─────────────────────────────────────────────────────────────
  /** Charter entries for a league + season, assembled with each entry's
   *  approval state. Returns empty array if none seeded yet. */
  getCharter(leagueId: string, season: string): Promise<CharterEntry[]>;
  /** Seed the standard charter template (Draft date, Buy-in, Watch Party, …)
   *  for a new league + season. Idempotent — no-op if entries already exist.
   *  Internally chains seedPollsForLeague first so derived-from-poll
   *  entries land with their FK set. */
  seedCharterForLeague(leagueId: string, season: string, viewerId: string): Promise<void>;
  /** Seed the standard set of polls for a new league. Returns a map of
   *  the mock template id → the real polls.id UUID so callers can wire
   *  back-references (e.g. charter entries that derive from a poll).
   *  Idempotent — looks up existing polls by (leagueId, template-key
   *  embedded in title) before inserting. */
  seedPollsForLeague(leagueId: string, viewerId: string): Promise<Map<string, string>>;
  /** Propose a value for an entry (flips status draft → pending). */
  proposeCharterEntry(entryId: string, userId: string, value: string): Promise<void>;
  /** Cast / clear an approval on a pending entry. Locks the entry when
   *  the approval threshold is met. */
  approveCharterEntry(entryId: string, userId: string, approved: boolean): Promise<void>;
  /** Create a custom charter entry (user-added group or one-off rule). */
  createCharterEntry(input: CreateCharterEntryInput): Promise<CharterEntry>;

  // ─── Polls ───────────────────────────────────────────────────────────────
  /** Polls for a league. Filter by statuses (defaults to 'open' + 'closed'). */
  /** League polls. `nflWeekId` narrows to one week's polls — the normal
   *  read, since a poll only ever surfaces in the week it belongs to. */
  getPolls(
    leagueId: string,
    opts?: { statuses?: PollStatus[]; nflWeekId?: string }
  ): Promise<LeaguePoll[]>;
  /** Single poll by id, fully assembled (options + responses + pending lane). */
  getPoll(pollId: string): Promise<LeaguePoll | null>;
  /** Cast / replace a member's vote on a poll. Single-choice uses
   *  `choiceId`; multi-select uses `choiceIds`; ranked-choice uses
   *  `rankings`. `{ clear: true }` withdraws the member's vote. */
  submitPollResponse(pollId: string, userId: string, vote: PollVote): Promise<void>;
  /** Member adds an option to a curated/open poll. For 'curated' policies
   *  the option lands in the pending lane until the commish promotes it. */
  addPollOption(pollId: string, userId: string, label: string): Promise<void>;
  /** Up/down/clear reaction to a pending option (curated polls only). */
  reactToPollOption(pollId: string, optionId: string, userId: string, value: 1 | -1 | null): Promise<void>;
  /** Admin: create a new poll. */
  createPoll(input: CreatePollInput): Promise<LeaguePoll>;
  /** Admin: move a pending option into the approved set. */
  promotePollOption(pollId: string, optionId: string): Promise<void>;
  /** Admin: status transitions. */
  closePoll(pollId: string): Promise<void>;
  reopenPoll(pollId: string): Promise<void>;
  archivePoll(pollId: string): Promise<void>;
}

// ─── Mutation inputs ──────────────────────────────────────────────────────

export type PollVote =
  | { choiceId: string }
  | { choiceIds: string[] }
  | { rankings: RankedSelection[] }
  | { clear: true };

export interface CreatePollInput {
  leagueId: string;
  /** The week the poll lives in. */
  nflWeekId: string;
  kind: PollKind;
  title: string;
  prompt: string;
  topic: 'punishment' | 'payout' | 'rules' | 'season' | 'fun' | 'logistics';
  optionPolicy: PollOptionPolicy;
  isAnonymous?: boolean;
  maxRanks?: number;
  parentPollId?: string | null;
  options: Array<{ label: string; hint?: string }>;
  closesAt?: Date | null;
  createdBy: string;
}

export interface CreateCharterEntryInput {
  leagueId: string;
  season: string;
  key: string;
  label: string;
  category: CharterCategory;
  description?: string | null;
  approvalRule: CharterApprovalRule;
  threshold?: number | null;
  pollId?: string | null;
  proposedBy: string;
  /** Free-form payload (jsonb) — custom entries carry `{ group }`. */
  metadata?: CharterEntry['metadata'] | null;
}

// ─── Adapter selection ──────────────────────────────────────────────────────
// `NEXT_PUBLIC_DATA_SOURCE=mock|neon` picks the impl. Default: 'mock'
// (kept as a permanent dev/demo tool); production runs 'neon'.

let _instance: DataAdapter | null = null;

export async function getDataAdapter(): Promise<DataAdapter> {
  if (_instance) return _instance;
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock';
  if (source === 'neon') {
    const mod = await import('./neon-adapter');
    _instance = mod.neonAdapter;
  } else {
    const mod = await import('./mock-adapter');
    _instance = mod.mockAdapter;
  }
  return _instance;
}

/** For tests / dev — override the cached adapter instance. */
export function __setAdapter(adapter: DataAdapter | null) {
  _instance = adapter;
}
