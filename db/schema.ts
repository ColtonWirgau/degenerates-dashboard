// Drizzle schema — single source of truth for the Neon database.
// Covers everything the mock owns plus the charter + polls reconciliation
// from PLAN.md A12 + B1.
//
// Conventions:
//   - Auth.js tables use `text('id')` (matches @auth/drizzle-adapter expectations)
//   - Domain entities use `uuid('id').defaultRandom()`
//   - All timestamps stored as `timestamptz`
//   - `$onUpdate` keeps mutable rows' `updated_at` in sync without DB triggers
//   - Indexes / unique constraints declared inline next to the tables they belong to

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AdapterAccountType } from 'next-auth/adapters'

// ─── Enums ──────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['owner', 'admin', 'member'])

export const legResultEnum = pgEnum('leg_result', ['win', 'loss', 'push'])

export const weekKindEnum = pgEnum('week_kind', [
  // Week 0 of every season — no games, so no slate and no parlay. It's the
  // week the league *runs itself*: charter, votes, draft logistics. Having
  // it be a real week (not a special "home" screen) is what lets the whole
  // app be week-shaped.
  'preseason',
  'regular',
  'wildcard',
  'divisional',
  'conference',
  'super-bowl',
])

export const gameStatusEnum = pgEnum('game_status', [
  'scheduled',
  'in-progress',
  'final',
  'postponed',
  'canceled',
])

export const validationStatusEnum = pgEnum('validation_status', [
  'approved',
  'conflicting',
])

export const gradedByEnum = pgEnum('graded_by', ['manual', 'auto', 'ai'])

export const pollKindEnum = pgEnum('poll_kind', ['single', 'multi', 'ranked'])

export const pollStatusEnum = pgEnum('poll_status', [
  'draft',
  'open',
  'closed',
  'archived',
])

export const pollOptionPolicyEnum = pgEnum('poll_option_policy', [
  'closed',
  'open',
  'curated',
])

export const pollOptionStatusEnum = pgEnum('poll_option_status', [
  'approved',
  'pending',
])

export const pollTopicEnum = pgEnum('poll_topic', [
  'punishment',
  'payout',
  'rules',
  'season',
  'fun',
  'logistics',
])

export const charterStatusEnum = pgEnum('charter_status', [
  'draft',
  'pending',
  'locked',
])

export const charterApprovalRuleEnum = pgEnum('charter_approval_rule', [
  'commish',
  'majority',
  'supermajority',
  'unanimous',
  'poll',
])

export const charterCategoryEnum = pgEnum('charter_category', [
  'logistics',
  'rules',
  'punishment',
  'format',
  'custom',
  'stakes',
  'keepers',
  'trading',
  'playoffs',
])

export const charterSourceEnum = pgEnum('charter_source', [
  'manual',
  'derived-from-poll',
])

// Day-of-week enum for slate config. Stored as `text[]` on leagues, but we
// type-narrow via TS rather than a PG array of enum (Drizzle's enum-array
// support is rough; plain text[] is simpler and the application enforces).
export type SlateDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

// ─── Auth.js tables (canonical shape from @auth/drizzle-adapter) ────────────

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique().notNull(),
  emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
  image: text('image'),
  // ─── Sleeper integration (B+) ───────────────────────────────────────
  // Set on first-time link when a user claims a stub seat from a
  // Sleeper-imported league. Nullable so non-Sleeper users are unaffected.
  sleeperUserId: text('sleeper_user_id'),
  sleeperUsername: text('sleeper_username'),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (vt) => ({ pk: primaryKey({ columns: [vt.identifier, vt.token] }) })
)

// ─── Leagues ────────────────────────────────────────────────────────────────

export const leagues = pgTable('leagues', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: text('created_by').references(() => users.id),

  // ─── Slate config ───────────────────────────────────────────────────
  // Which NFL weekdays count toward the league's parlay. Default mirrors
  // the typical friend-group convention (Sun + Mon, excludes TNF).
  slateDaysIncluded: text('slate_days_included')
    .array()
    .notNull()
    .default(['sun', 'mon']),
  // Tentpole holiday games (Thanksgiving, Black Friday, Christmas Day)
  // ride this toggle independent of the days picker. Default on.
  slateIncludeHolidays: boolean('slate_include_holidays').notNull().default(true),
  // Minutes before the first in-slate kickoff that the parlay locks.
  // 10 is a balanced default; admins can pick 5/10/15/30/60.
  lockOffsetMinutes: integer('lock_offset_minutes').notNull().default(10),

  // ─── Sleeper integration (B+) ───────────────────────────────────────
  sleeperLeagueId: text('sleeper_league_id'),
  // Walked back lazily on first request. Shape: [{season, leagueId}, ...]
  sleeperHistoryChain: jsonb('sleeper_history_chain'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

export const leagueMembers = pgTable(
  'league_members',
  {
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('member'),
    // For Sleeper-imported stub seats: set on import, cleared/merged
    // when the real user claims the seat via Google sign-in.
    sleeperUserId: text('sleeper_user_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.leagueId, t.userId] }) })
)

export const leagueInvitations = pgTable(
  'league_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => ({ emailIdx: index('league_invitations_email_idx').on(t.email) })
)

// ─── NFL schedule ───────────────────────────────────────────────────────────
// One canonical row per (season, week_number). Shared across all leagues —
// every league points at the same source-of-truth schedule. Re-seeded by
// `scripts/load-nfl-schedule.ts` (idempotent upsert).

export const nflWeeks = pgTable(
  'nfl_weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season: text('season').notNull(), // e.g. '2026-2027'
    weekNumber: integer('week_number').notNull(), // 1..22
    kind: weekKindEnum('kind').notNull().default('regular'),
    // First kickoff of any game in the week (set on load + each sync).
    startDate: timestamp('start_date', { withTimezone: true }),
    // Tuesday ~05:00 ET roll-over after MNF.
    endDate: timestamp('end_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    seasonWeekUnique: uniqueIndex('nfl_weeks_season_week_unique').on(
      t.season,
      t.weekNumber
    ),
  })
)

export const nflTeams = pgTable('nfl_teams', {
  // 3-letter abbreviation as PK — stable, matches ESPN's identifier and
  // every fantasy / book payload we'd ever consume.
  abbr: text('abbr').primaryKey(), // 'DAL', 'PHI', …
  name: text('name').notNull(), // 'Cowboys'
  fullName: text('full_name').notNull(), // 'Dallas Cowboys'
  city: text('city').notNull(),
  conference: text('conference').notNull(), // 'AFC' | 'NFC'
  division: text('division').notNull(), // 'East' | 'West' | …
  primaryColor: text('primary_color'), // hex, e.g. '#003594'
  secondaryColor: text('secondary_color'),
  logoUrl: text('logo_url'),
})

export const nflGames = pgTable(
  'nfl_games',
  {
    // Upstream provider id (ESPN event id) so loader re-runs upsert cleanly.
    id: text('id').primaryKey(),
    nflWeekId: uuid('nfl_week_id')
      .notNull()
      .references(() => nflWeeks.id, { onDelete: 'cascade' }),

    homeTeam: text('home_team').notNull(), // FK to nfl_teams.abbr (no strict FK so loader can run before teams seed)
    awayTeam: text('away_team').notNull(),
    homeTeamName: text('home_team_name').notNull(),
    awayTeamName: text('away_team_name').notNull(),

    kickoff: timestamp('kickoff', { withTimezone: true }).notNull(),
    // Originally-scheduled weekday (one of 'mon'..'sun'). Set once on
    // game create and never touched by postponement sync — keeps slate
    // filtering stable when kickoff shifts.
    scheduledDay: text('scheduled_day').notNull(),
    isHolidayGame: boolean('is_holiday_game').notNull().default(false),

    // Null until the ball is in the air — ESPN reports 0–0 pre-kickoff.
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    status: gameStatusEnum('status').notNull().default('scheduled'),
    // Live game state, refreshed while a slate is running. `period` is the
    // quarter (5+ = OT) and survives to final; `displayClock` ("7:24") is
    // only meaningful in-progress and is cleared otherwise.
    period: integer('period'),
    displayClock: text('display_clock'),

    network: text('network'),
    venue: text('venue'),
    finalAt: timestamp('final_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    weekIdx: index('nfl_games_week_idx').on(t.nflWeekId),
    kickoffIdx: index('nfl_games_kickoff_idx').on(t.kickoff),
  })
)

// Per-league per-week cache of derived lock-time. Filled by the
// `recomputeLockAt` action. Stays null when no in-slate game has a
// concrete kickoff yet (flex windows). UI reads this directly — no
// repeated derivation per page load.
export const leagueWeeks = pgTable(
  'league_weeks',
  {
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    nflWeekId: uuid('nfl_week_id')
      .notNull()
      .references(() => nflWeeks.id, { onDelete: 'cascade' }),
    lockAtCached: timestamp('lock_at_cached', { withTimezone: true }),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.leagueId, t.nflWeekId] }) })
)

// ─── Parlays + legs ─────────────────────────────────────────────────────────
// One parlay per (league, nfl_week). Members each contribute one leg.
// Total odds + overall result derived from legs — not stored.

export const parlays = pgTable(
  'parlays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    nflWeekId: uuid('nfl_week_id')
      .notNull()
      .references(() => nflWeeks.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    leagueWeekUnique: uniqueIndex('parlays_league_week_unique').on(
      t.leagueId,
      t.nflWeekId
    ),
  })
)

export const parlayLegs = pgTable(
  'parlay_legs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parlayId: uuid('parlay_id')
      .notNull()
      .references(() => parlays.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    legNumber: integer('leg_number').notNull().default(0),
    description: text('description').notNull(),
    odds: integer('odds').notNull(), // American odds: -110, +145
    result: legResultEnum('result'),
    validationStatus: validationStatusEnum('validation_status'),
    validationMessage: text('validation_message'),
    // null = draft (editable). non-null = submitted, immutable for the user.
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    gradedBy: gradedByEnum('graded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    parlayUserUnique: uniqueIndex('parlay_legs_parlay_user_unique').on(
      t.parlayId,
      t.userId
    ),
  })
)

// ─── Polls ──────────────────────────────────────────────────────────────────
// Structured votes (single or ranked). Pending-option lane + per-option
// reactions live in dedicated tables. Closed/archived polls remain
// queryable but are hidden from the active docks.

export const polls = pgTable(
  'polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    // The week this poll belongs to. Every poll lives in a week — league
    // business (charter, punishments, draft logistics) in the preseason
    // week, one-off in-season questions in whichever week raised them.
    // Nullable only so the column could be added to existing rows; the
    // backfill points every poll at a real week and readers treat a null
    // as "preseason".
    nflWeekId: uuid('nfl_week_id').references(() => nflWeeks.id, {
      onDelete: 'cascade',
    }),
    kind: pollKindEnum('kind').notNull(),
    status: pollStatusEnum('status').notNull().default('draft'),

    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    topic: pollTopicEnum('topic').notNull(),
    // Who can add options. 'closed' = admin-only, 'open' = anyone (auto-
    // approved), 'curated' = anyone proposes → goes to pending lane.
    optionPolicy: pollOptionPolicyEnum('option_policy').notNull().default('closed'),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    // For ranked polls (typical: 3). Null for single-choice.
    maxRanks: integer('max_ranks'),
    // Two-phase flow: derived vote-poll points back at the submission poll.
    // (Self-reference needs the explicit return type to break the cycle.)
    parentPollId: uuid('parent_poll_id').references((): AnyPgColumn => polls.id),
    // Stable identifier tying a seeded poll to its template (e.g.
    // 'tie-breaker', 'commish-2026'). Lets the seed-on-first-load path
    // stay idempotent + lets charter entries link back via FK lookup.
    // Null for user-created polls.
    templateKey: text('template_key'),

    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    leagueStatusIdx: index('polls_league_status_idx').on(t.leagueId, t.status),
    weekIdx: index('polls_week_idx').on(t.nflWeekId),
    // Unique per (league, template) so the seed can upsert cleanly.
    leagueTemplateUnique: uniqueIndex('polls_league_template_unique').on(
      t.leagueId,
      t.templateKey
    ),
  })
)

export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    hint: text('hint'),
    // For curated polls: 'pending' until commish promotes → 'approved'.
    // For closed/open polls: 'approved' on creation.
    status: pollOptionStatusEnum('status').notNull().default('approved'),
    addedBy: text('added_by').references(() => users.id),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    // Ordering inside the poll — used for display + ranked rendering.
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({ pollIdx: index('poll_options_poll_idx').on(t.pollId) })
)

export const pollResponses = pgTable(
  'poll_responses',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Discriminated by poll.kind:
    //   single: [{ choiceId: 'uuid' }]
    //   ranked: [{ choiceId: 'uuid', rank: 1 }, …]
    selections: jsonb('selections').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pollId, t.userId] }) })
)

// Up/down reactions on pending options (curated polls only). Drives the
// signal the commish uses to decide which pending options to promote.
export const pollOptionReactions = pgTable(
  'poll_option_reactions',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(), // 1 (up) or -1 (down)
    reactedAt: timestamp('reacted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pollId, t.optionId, t.userId] }) })
)

// ─── Charter ────────────────────────────────────────────────────────────────
// Structured per-season facts (buy-in, keeper rules, watch-party location,
// punishment, etc.) with per-entry approval rules + status lifecycle.
// Built outside the original PLAN — see PLAN A12 for the design.

export const charterEntries = pgTable(
  'charter_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    season: text('season').notNull(),

    // Stable machine key — 'draft-date', 'commissioner', 'buy-in', etc.
    // Custom user-added entries get auto-generated keys.
    key: text('key').notNull(),
    label: text('label').notNull(),
    category: charterCategoryEnum('category').notNull(),

    // The ratified value. Null until status === 'locked'. Concise — full
    // explanation lives in `description`.
    value: text('value'),
    description: text('description'),

    source: charterSourceEnum('source').notNull().default('manual'),
    pollId: uuid('poll_id').references(() => polls.id),

    approvalRule: charterApprovalRuleEnum('approval_rule').notNull(),
    // 0..1 fraction, required for 'supermajority'. Null otherwise.
    threshold: real('threshold'),

    status: charterStatusEnum('status').notNull().default('draft'),

    // Pending-proposal metadata. Set when status flips draft → pending;
    // cleared (or kept as historical) when status flips pending → locked.
    pendingValue: text('pending_value'),
    proposedBy: text('proposed_by').references(() => users.id),
    proposedAt: timestamp('proposed_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),

    // Special-case payload (e.g. eligible-keepers roster). Free-form
    // jsonb so each entry type owns its own shape.
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    leagueSeasonKeyUnique: uniqueIndex('charter_entries_league_season_key_unique').on(
      t.leagueId,
      t.season,
      t.key
    ),
  })
)

// Per-user approvals on a charter entry. Threshold logic counts these
// against the entry's approval rule + threshold + league member count.
export const charterApprovals = pgTable(
  'charter_approvals',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => charterEntries.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    approved: boolean('approved').notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.entryId, t.userId] }) })
)

// ─── Relations ──────────────────────────────────────────────────────────────

export const leaguesRelations = relations(leagues, ({ many }) => ({
  members: many(leagueMembers),
  parlays: many(parlays),
  invitations: many(leagueInvitations),
  polls: many(polls),
  charterEntries: many(charterEntries),
  leagueWeeks: many(leagueWeeks),
}))

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueMembers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueMembers.userId],
    references: [users.id],
  }),
}))

export const nflGamesRelations = relations(nflGames, ({ one }) => ({
  week: one(nflWeeks, {
    fields: [nflGames.nflWeekId],
    references: [nflWeeks.id],
  }),
}))

export const parlaysRelations = relations(parlays, ({ one, many }) => ({
  league: one(leagues, {
    fields: [parlays.leagueId],
    references: [leagues.id],
  }),
  nflWeek: one(nflWeeks, {
    fields: [parlays.nflWeekId],
    references: [nflWeeks.id],
  }),
  legs: many(parlayLegs),
}))

export const parlayLegsRelations = relations(parlayLegs, ({ one }) => ({
  parlay: one(parlays, {
    fields: [parlayLegs.parlayId],
    references: [parlays.id],
  }),
  user: one(users, {
    fields: [parlayLegs.userId],
    references: [users.id],
  }),
}))

export const pollsRelations = relations(polls, ({ one, many }) => ({
  league: one(leagues, {
    fields: [polls.leagueId],
    references: [leagues.id],
  }),
  options: many(pollOptions),
  responses: many(pollResponses),
  reactions: many(pollOptionReactions),
}))

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id],
  }),
  reactions: many(pollOptionReactions),
}))

export const charterEntriesRelations = relations(charterEntries, ({ one, many }) => ({
  league: one(leagues, {
    fields: [charterEntries.leagueId],
    references: [leagues.id],
  }),
  poll: one(polls, {
    fields: [charterEntries.pollId],
    references: [polls.id],
  }),
  approvals: many(charterApprovals),
}))

export const charterApprovalsRelations = relations(charterApprovals, ({ one }) => ({
  entry: one(charterEntries, {
    fields: [charterApprovals.entryId],
    references: [charterEntries.id],
  }),
  user: one(users, {
    fields: [charterApprovals.userId],
    references: [users.id],
  }),
}))

export const leagueWeeksRelations = relations(leagueWeeks, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueWeeks.leagueId],
    references: [leagues.id],
  }),
  nflWeek: one(nflWeeks, {
    fields: [leagueWeeks.nflWeekId],
    references: [nflWeeks.id],
  }),
}))
