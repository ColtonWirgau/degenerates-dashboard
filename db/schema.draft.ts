// @ts-nocheck — Phase B draft. drizzle-orm and @auth/drizzle-adapter aren't
// installed yet; turn checking back on once we move into the Neon migration
// and run `npm install drizzle-orm @auth/drizzle-adapter pg`.
//
// This file reflects the post-A1 cleaned model:
//   • Lock-on-submit lifecycle (locked_at on legs, no parlay-level deadline/status)
//   • parlays table = (league_id, global_week_id) join + timestamps
//   • Total odds + state are computed, not stored
//   • Auth.js v5 owns users / accounts / sessions
//
// When B2 lands, rename this to db/schema.ts.

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AdapterAccountType } from 'next-auth/adapters'

// ─── Enums ──────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['owner', 'admin', 'member'])
export const legResultEnum = pgEnum('leg_result', ['win', 'loss', 'push'])
export const weekKindEnum = pgEnum('week_kind', [
  'regular',
  'wildcard',
  'divisional',
  'conference',
  'super-bowl',
])
export const validationStatusEnum = pgEnum('validation_status', [
  'approved',
  'conflicting',
])
export const gradedByEnum = pgEnum('graded_by', ['manual', 'auto', 'ai'])

// ─── Auth.js tables (canonical shape from @auth/drizzle-adapter) ────────────

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique().notNull(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
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
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({ pk: primaryKey({ columns: [vt.identifier, vt.token] }) })
)

// ─── Domain tables ──────────────────────────────────────────────────────────

export const leagues = pgTable('leagues', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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

// Global NFL week catalog — one row per (season, week_number). Shared across
// all leagues. Seeded from the NFL schedule once the season is announced;
// the schedule pull-in (Phase C) will refresh start_date / end_date.
export const nflWeeks = pgTable(
  'nfl_weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season: text('season').notNull(), // '2026-2027'
    weekNumber: integer('week_number').notNull(), // 1..22
    kind: weekKindEnum('kind').notNull().default('regular'),
    startDate: timestamp('start_date', { withTimezone: true }), // first kickoff
    endDate: timestamp('end_date', { withTimezone: true }), // ~Tue roll-over
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    seasonWeekUnique: uniqueIndex('nfl_weeks_season_week_unique').on(
      t.season,
      t.weekNumber
    ),
  })
)

// One parlay per (league, nfl_week). Members each contribute one leg.
// Total odds and overall result are derived from legs — not stored.
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    leagueWeekUnique: uniqueIndex('parlays_league_week_unique').on(
      t.leagueId,
      t.nflWeekId
    ),
  })
)

// One leg per (parlay, user). lockedAt = null means draft, editable.
// Once set, the leg is immutable for the user (delete + resubmit to swap).
// gradedBy / gradedAt track who/when set the result — for the auto-grading
// path we want to know if a result came from the sports-data API, AI, or
// a manual admin override.
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
    odds: integer('odds').notNull(), // American odds, e.g. -110, +145
    result: legResultEnum('result'),
    validationStatus: validationStatusEnum('validation_status'),
    validationMessage: text('validation_message'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    gradedBy: gradedByEnum('graded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parlayUserUnique: uniqueIndex('parlay_legs_parlay_user_unique').on(
      t.parlayId,
      t.userId
    ),
  })
)

// ─── Schedule + odds cache (Phase C / auto-grading prep) ────────────────────
// Populated by the NFL schedule + odds API integration. Not required for
// initial Neon cutover — leave commented until Phase C lands.
//
// export const nflGames = pgTable('nfl_games', {
//   id: text('id').primaryKey(), // upstream provider id
//   nflWeekId: uuid('nfl_week_id').notNull().references(() => nflWeeks.id),
//   homeTeam: text('home_team').notNull(),
//   awayTeam: text('away_team').notNull(),
//   kickoff: timestamp('kickoff', { withTimezone: true }).notNull(),
//   homeScore: integer('home_score'),
//   awayScore: integer('away_score'),
//   status: text('status').notNull(), // 'scheduled' | 'in-progress' | 'final'
//   finalAt: timestamp('final_at', { withTimezone: true }),
// })
//
// export const nflLines = pgTable('nfl_lines', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   gameId: text('game_id').notNull().references(() => nflGames.id),
//   book: text('book').notNull(), // 'draftkings' | etc.
//   market: text('market').notNull(), // 'spread' | 'moneyline' | 'total' | 'player-prop'
//   selection: text('selection').notNull(),
//   line: text('line'),
//   odds: integer('odds').notNull(),
//   fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
// })

// ─── Relations ──────────────────────────────────────────────────────────────

export const leaguesRelations = relations(leagues, ({ many }) => ({
  members: many(leagueMembers),
  parlays: many(parlays),
  invitations: many(leagueInvitations),
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
