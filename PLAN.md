# Refactor & Migration Plan

Working checklist. Update statuses inline. Open decisions live at the bottom.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[s]` skipped

---

## Status snapshot (2026-05-22)

- **Phase A — mock UI**: done. A4 visual / drag-close work re-folded into
  B10 — see B10 status below.
- **NFL schedule**: production data live. ESPN loader ported off
  Supabase onto Drizzle (`scripts/load-nfl-schedule.ts` + extracted
  `lib/nfl-schedule.ts`). 32 teams seeded, 285 games loaded for
  2026-2027 with `scheduled_day` (ET) + `is_holiday_game` derived.
- **Phase B — real users**: done end-to-end. Neon + Auth.js + Drizzle
  + Ably + Brevo magic-link + lock-time derivation + onboarding wizard
  all shipped. Supabase decommissioned (deps + code + middleware
  removed). See per-milestone status below.
- **Auth providers**: Google OAuth (`allowDangerousEmailAccountLinking`)
  + Nodemailer-via-Brevo for magic links. Resend was used briefly during
  the Auth.js cutover and removed when Brevo's domain auth went live
  (Brevo free tier allows custom-domain sender; Resend free tier didn't).
- **Charter system**: per-entry approval rules + status lifecycle shipped
  in mock and persisted in Neon via `seedCharterForLeague` /
  `seedPollsForLeague` (idempotent via `polls.template_key`).
- **Production deploy**: code-ready. The only remaining blockers are
  two user-side configuration items — listed under B9 below.

---

## Next up

**Blockers for prod deploy (you, not me):**
1. **Google OAuth prod redirect URI** — add
   `https://degeneratesdashboard.app/api/auth/callback/google` to the
   Google OAuth client in Google Cloud Console (keep localhost for dev).
2. **Vercel production env vars** — set:
   - `AUTH_URL=https://degeneratesdashboard.app`
   - `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `EMAIL_FROM`
   - `CRON_SECRET`
   - Confirm `DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
     `ABLY_API_KEY`, `NEXT_PUBLIC_DATA_SOURCE=neon` are present.

**Optional follow-ups (mine when you're ready):**
- B10 deferred items: real-device iOS Safari pass + PeekCard visual
  revisit (subjective; needs design direction from you first).
- `components/week-slate.tsx` still uses hardcoded team colors / abbrs —
  swap to a `nfl_teams` table read now that the table is populated.
- Sleeper import — currently a placeholder step 4 in the league wizard.
  Defer until someone actually wants to import a Sleeper league.

**Dev start command:** `npm run dev` → http://localhost:3001
(`AUTH_URL` in `.env.local` is pinned to `:3001` so magic links match.)

---

## Phase A — UI/UX refactor (mock-mode)

The mock data adapter (`lib/data/`) and dev toolbar handle iteration without
touching a real DB. Goal: land the data model and UI shape we want before
porting to Neon.

### A0 · Foundations (done)
- [x] Snapshot live Supabase data → anonymized fixtures
- [x] Domain types + `DataAdapter` interface
- [x] Mock adapter with 8 scenarios (offseason → super bowl)
- [x] Server actions wired through adapter
- [x] Dev toolbar (scenario picker + identity switcher)
- [x] Season-state awareness (banner per state)
- [x] Header league picker (replaces `/leagues` page)
- [x] Leaderboard → user detail sheet (replaces `/leagues/[id]/users/[userId]`)
- [x] Profile sheet (replaces `/profile`)
- [x] AI parlay validation on submit (gold conflict banner)
- [x] Dead admin lifecycle UI removed (edit-deadline, lock-week, close-week)

### A1 · Lifecycle finalization (done)
Commit fully to lock-on-submit. Decisions documented in §1; mock adapter
now enforces them and the legacy compat layer derives anything the old UI
expects (status, deadline, total odds) from leg state.

- [x] Document data-model decisions (Open decisions §1)
- [x] `parlays.deadline` — not synthesized; derived from `nfl_week.startDate` for legacy UI
- [x] `parlays.status` — not synthesized; computed from leg lock/result state
- [x] `parlays.total_odds` — computed on read from legs
- [x] `parlays.result`, `payout_amount`, `completed_at` — gone from domain types
- [x] `parlay_legs.locked_at` is the source of truth for "submitted"
- [x] Edit-after-lock policy: locked legs are immutable for the user; delete-and-resubmit to change. Admins can delete any leg.
- [x] Mock adapter `submitLeg` rejects re-submit when locked
- [x] Mock adapter `deleteLeg` implemented (with overlay invalidation)
- [x] `deleteLeg` server action wired with role-based authorization
- [x] `lockedAt` exposed on leg shapes for UI
- [x] Typecheck green

### A2 · Week page restructure (done)
Restructured into a thin server-component dispatcher branching on derived
`ParlayState`. Five focused views, no kitchen sink.

- [x] New composite read: `app/actions/week-overview.ts` (mirrors `getLeagueOverview`)
- [x] Page rewrite: thin dispatcher with `<StatusPill>` for all 5 states
- [x] **State 1** (open + not submitted) → `<SubmitLegForm>` + `<SubmissionProgress>` sidebar
- [x] **State 2** (open + submitted/locked) → `<YourLockedLeg>` (delete & resubmit) + progress sidebar
- [x] **State 3** (locked, awaiting results) → `<TheLay>` with combined-odds badge
- [x] **State 4** (graded) → `<TheLay>` with per-leg result chips, admin grading buttons
- [x] **State 5** (won/lost) → `<TheLay>` with hero + leg breakdown (losing legs sorted to top)
- [x] New components: `your-locked-leg.tsx`, `submission-progress.tsx`
- [x] `the-lay.tsx` slimmed (489 → 366 LOC, ditched realtime + lock/unlock)
- [x] Deleted: `final-parlay-display.tsx`, `all-legs-display.tsx`
- [x] Fixed `computeParlayState` in mock adapter to factor in expected
      member count (was firing 'locked' when only 60% submitted, forcing
      a workaround on the page side; now correct at the adapter layer)

### A3 · Member management → sheet (done)
- [x] Replaced 425-LOC dialog with `components/member-management-sheet.tsx`
- [x] Three sub-pages: Members / Invite by email / Invite link
- [x] Per-row `SheetPageKebab` (owner/admin only) for promote/demote/remove with optimistic UI
- [x] Invite-by-email form → `inviteMember` action with success/error inline
- [x] Invite-link page → copyable URL + regenerate (with confirm)
- [x] League page swapped to import the new sheet

### A9 · Avatar = single "you" surface (done)
Consolidated identity + league switching + per-league management under
one avatar trigger. Six-page `<UserMenu>` sheet replaces three older
sheets and the LeaguePicker pill.

- [x] Avatar trigger opens a multi-page `ResponsiveSheet`:
  - `main` — identity hero + Edit Profile link + "Manage [current league]" CTA + leagues list (tap to switch) + Sign Out
  - `profile` — edit profile form
  - `league` — per-league actions, role-gated (admin: Members / Invite by email / Invite link; member: Leave league)
  - `members` — lazy-loaded member list with per-row kebab (promote/demote/remove)
  - `invite-email` — email-invite form with copy-to-clipboard on success
  - `invite-link` — copyable URL + regenerate (with confirm)
- [x] Header simplified — `LeaguePicker` pill removed; only the avatar
- [x] League page header — "Members" button removed (now under avatar)
- [x] Deleted `components/league-picker.tsx`, `components/profile-sheet.tsx`, `components/member-management-sheet.tsx`

### A8 · Leaderboard → drill-in sheet (done)
- [x] Removed inline Leaderboard section from the league page
- [x] New `<LeaderboardSheet>` — multi-page (main: rows / user: detail with prev/next chevrons), drives both drill-ins
- [x] New `<PerformanceSection>` client wrapper hosts both triggers and the sheet:
  - Footer CTA: "See where you stack →"
  - Tap-on-donut: opens sheet with `focusUserId=me`, lands on user-detail directly
- [x] Deleted `components/leaderboard-with-sheet.tsx` (replaced by the multi-page sheet)

### A7 · SectionHeader + flatten card-on-card (done)
- [x] New `<SectionHeader>` (`components/ui/section-header.tsx`) — Anton-condensed neon title with kicker eyebrow, accent bar, optional icon, color-tunable (`blue` / `pink` / `gold` / `green` / `purple`), trailing slot for buttons
- [x] Replaced outer `<Card>` wrappers on the league page with `<section>` + `<SectionHeader>`: Your Performance (blue, BarChart3), Leaderboard (gold, Trophy), Final Standings (purple, History)
- [x] `RecentLegs` flattened — dropped outer `glass-card`, leg rows are now subtle bordered rows
- [x] `PerformanceChart` flattened — dropped outer `glass-card` wrapper

### A6 · Floating dock + history strip (done)
Replaced the card-on-card `<WeekNavigator>` with a floating-bottom dock for
the current week and a horizontal pill strip for past weeks. Sheet drives
all detail drill-in.

- [x] `<CurrentWeekDock>` — floats bottom of viewport, state-aware label
      (Lock in / Locked in / Awaiting kickoff / Grading / WON / LOST),
      avatar stack of who's in. Tap → opens sheet (lands on submit page
      directly when you haven't submitted yet)
- [x] `<WeekHistoryStrip>` — horizontal scroll of past weeks, color-coded
      pills (won blue / lost pink / locked gold), tap to peek
- [x] `<WeekDetailSheet>` — multi-page sheet: main / submit / submitted /
      slackers / winners / losers. State-aware headline, drill-rows with
      avatar previews
- [x] League page restructured: dock floats at bottom, history strip at
      top, leaderboard + performance card unchanged
- [x] Deleted `<WeekNavigator>` (288 LOC, replaced by 3 focused components)

### A4 · Mobile polish pass (deferred → B10)
Folded into Phase B as the last milestone — wants a real-device pass
once the underlying data + persistence is stable, not before. See B10.
Phase A is functionally complete after this. Best done with a real phone
in hand — list of things to verify/fix:

- [ ] Bottom-sheet drag close on real iOS Safari + Android Chrome
- [ ] League picker pill width / truncation on small screens
- [ ] User-detail sheet prev/next chevron tap targets (44px min)
- [ ] Profile sheet form sizing + iOS keyboard zoom (`font-size: 16px+` on inputs)
- [ ] Submit-leg form keyboard behavior
- [ ] Week page state transitions (state 1 → 2 transitions on submit, etc.)
- [ ] Member management sheet sub-page nav on small screen

### A5 · Result-grading approach (decided)
**Auto-grade via sports-data API, with AI as a fallback for free-text props.**

- [x] Decision: API-first, AI on the props the API can't match cleanly
- [x] Schema impact captured in `db/schema.draft.ts`:
  - `parlay_legs.gradedAt` / `gradedBy` (`'manual' | 'auto' | 'ai'`)
  - Future-tense `nfl_games` / `nfl_lines` cache tables (commented out — light up in Phase C)
- [ ] Mock adapter support: leave manual-grade path; auto-grade is post-cutover
- [ ] Phase C will pick the API (The Odds API has free tier with /scores; sportsdata.io is more thorough but paid)

### A11 · Page restructure — "right now" focus + League sheet (done)

**Why.** As the page acquired the WeekSlate (live scores per game, bets
per game, day groupings) + the always-on top dock + the personal
PerformanceSection + the bottom dock owning the user's leg, everything
on the page became "right now" content — *except* `<SeasonFormStrip>`,
which is a season-arc vibe-check, not actionable. Plus the page has two
headers competing for hierarchy (site `<Header />` bar + a massive league-
name banner). Consolidate the headers, move season-long content into a
new sheet, and use that sheet as the natural home for year-switching
and league settings.

**End state — main page contains:**
- Compact league bar (replaces the dual header). Avatar + league name +
  current season chip (e.g. `2026-27`), tappable to open the League
  sheet. User-menu avatar stays on the right.
- Always-on top dock (unchanged — week context).
- WeekSlate (unchanged — current week's games, slate filter, live scores
  per game). This is the "right now" headline.
- PerformanceSection (unchanged — your personal rank + recent legs).
- Bottom dock (unchanged — your leg / poll voter).

**What moves into the League sheet:**
- League name + member count + invite link
- **Season switcher** — a dropdown / chip row populated from the
  existing `availableSeasons` payload. Picks which season the rest of
  the sheet renders. Defaults to the active season; flipping it pulls
  in last-season's data (existing `getLeagueOverview` already supports
  per-season reads via the `season` arg — wire the sheet's state to
  re-fetch or pass through).
- `<SeasonFormStrip>` (per selected season). Lifted out of the page.
- Final Standings table per season (currently rendered as a top-level
  section in offseason — moves here so it's available year-round, not
  just in offseason).
- **League settings tabs** (placeholders for now, fleshed out when the
  underlying features land):
  - **Slate** — picker (`Sunday + Monday`, `Full week`, `Sunday only`,
    Custom) + lock-offset stepper. See Phase C slate spec.
  - **Members** — list with admin role badges + remove-member action.
  - **Invite** — invite link + copy button (already exists in the
    current `WeekDetailSheet`'s admin path; move here).
  - **History** — placeholder. Eventually surfaces closed polls (see
    history-view sheet), all-time leaderboards, championship recap.

**Component shape:**
- New `<LeagueSheet>` built on `<ResponsiveSheet>` + multiple
  `<SheetPage>` children — same pattern as `WeekDetailSheet`. Subpages:
  `main` (overview + season strip + standings), `settings`,
  `members`, `invite`, `history`.
- New `<LeagueBar>` — compact horizontal bar replacing the current
  `<header>` + giant title. Tap → opens `<LeagueSheet>`.

**Offseason / preseason interaction.** Currently the offseason flow
shows Final Standings as a section under the polls hub. Move it into
the sheet too. The offseason page body then becomes: polls hub (full
height) + SchedulePreview during preseason. No top-level standings
table — accessible via the League sheet.

**Implementation order — each step shippable in isolation:**

1. **`<LeagueBar>` + `<LeagueSheet>` shell.**
   Compact bar replaces the site header + title block on the league
   page. Sheet opens on tap, shows just league name + member count +
   invite link copy. No data dependency beyond what `getLeagueOverview`
   already returns.

2. **Move `<SeasonFormStrip>` into the sheet.**
   Removed from the main page. Sheet `main` page renders it under the
   league overview. Default to active season; no switcher yet.

3. **Season switcher.**
   Add a chip row above the FormStrip on the sheet's `main` page. Uses
   existing `availableSeasons`. Re-fetches via `getLeagueOverview(id,
   { season })` — small action update to accept the `season` arg.
   Mock adapter already generates prev-season data; wire it through.

4. **Move offseason Final Standings into the sheet.**
   Removed from the offseason page body. Lives under the sheet's
   `main` page below the FormStrip when a non-active season is
   selected.

5. **Settings tab (slate + lock-offset placeholder).**
   New SheetPage `settings`. Renders the slate picker + lock-offset
   stepper. State persists to a new `updateLeagueSettings` action
   that just writes to the `leagues` row (matches the Phase C
   schema additions for `slate_days_included`, `slate_include_holidays`,
   `lock_offset_minutes`).

6. **Members tab.**
   Existing member-management UI lifts into the sheet's `members`
   SheetPage.

7. **Invite tab.**
   Existing invite-link copy UI lifts into `invite` SheetPage.

8. **History placeholder.**
   Stub SheetPage announcing the closed-polls history view, all-time
   leaderboard, etc.

**What stays unchanged:**
- Top dock (in-season + offseason variants)
- Bottom dock (composer / your-leg / polls voter)
- WeekSlate (slate filters, drill-in sheet, status rings)
- PerformanceSection
- Current `WeekDetailSheet` and `GameDetailSheet` continue to live
  as drill-in surfaces from the main page.

**What this restructure does NOT touch:**
- Backend reads (existing `getLeagueOverview` covers it; only new
  argument is `season`).
- Bottom dock or top dock behavior.
- Polls hub.
- Schema (slate fields, lock_offset still live in Phase B's roadmap).

**Open question worth deferring**: do we eventually let users switch
*leagues* from the bar too (multi-league users), or is the avatar
menu's "I'm in 3 leagues" the only switcher? Lean toward keeping
league-switching in the avatar menu; league bar = current league only.

### A12 · Season setup mock (charter + polls + PeekCards) (done)

Not in the original plan — emerged from iteration on the offseason
experience. Two parallel systems shipped in mock that need
reconciliation when we move to a real schema:

- **Charter** (`lib/data/mock-charter.ts`) — structured per-season
  facts (Draft date, buy-in, keeper rules, watch-party location, etc.)
  with per-entry approval rules (commish / majority / supermajority /
  unanimous / poll-derived), status lifecycle (draft → pending → locked),
  and optional `pollId` linking entries whose value comes from a poll.
- **Polls upgrade** (`lib/data/mock-polls.ts`) — kept the `single` /
  `ranked` kinds but added `optionPolicy` (`closed | open | curated`)
  and a `pending` lane on options so members can pitch additions that
  the league up/down-votes before the commish promotes them.

UI shipped:
- [x] PeekCard slider grid replacing the original GroupCard masonry —
      single-entry cards with a slide-up reveal pattern, sectioned per
      category, rotated brand colors (pink/cyan/gold/green).
- [x] Live donut on the peek layer when an entry's poll is open
      (single + ranked-weighted).
- [x] Description field on charter entries; concise `value` on the
      card, full prose in the expanded EntryDock.
- [x] Multi-action BottomDock (poll votes + charter approvals in one
      queue).
- [x] Custom user-added charter categories + entries (session-only
      mock; persistence in B4).
- [~] PeekCard visual polish — user flagged "not super happy yet";
      revisit during B10 mobile pass.

Schema reconciliation owned by Phase B1.

---

## Phase B — Real Users  *(complete)*

Every flow that was mock now works for real friends. Auth via Auth.js
v5 (Google OAuth + Nodemailer-via-Brevo magic links). Real-time via
**Ably**. Migration from Supabase → Neon is done and Supabase is fully
decommissioned from the codebase.

### B1 · Drizzle schema — done ✓
All tables defined and migrated to Neon:
- `nfl_weeks` (with `kind` enum) + `nfl_teams` (32 rows seeded) + `nfl_games`
  (with `scheduled_day` ET and `is_holiday_game`)
- `polls` (with `template_key` for idempotent seeding) + `poll_options` +
  `poll_responses` + `poll_option_reactions`
- `charter_entries` (with `pending_value` for the pending lane) +
  `charter_approvals`
- `leagues` columns: `slate_days_included` (default `{sun,mon}`),
  `slate_include_holidays` (default true), `lock_offset_minutes` (default 10),
  `sleeper_league_id`, `sleeper_history_chain`
- `users` columns: `sleeper_user_id`, `sleeper_username`
- `league_weeks` cache (`lock_at_cached`, `computed_at`)
- Auth.js tables: `users`, `accounts`, `sessions`, `verification_tokens`

### B2 · Neon + Auth.js v5 — done ✓
- Neon project + `DATABASE_URL` provisioned
- Drizzle migrations applied (see `db/migrations/`)
- `auth.ts` configured with Google + Nodemailer providers + Drizzle adapter
- `allowDangerousEmailAccountLinking: true` on Google so migrated users
  can link their Google account by email
- Sign-in lives on the home page (`/`) — no separate `/signin` route.
  Magic-link form is inline (`components/magic-link-form.tsx`) with a
  "Check your inbox" success state, no redirect to `/verify-request`

### B3 · `lib/data/neon-adapter.ts` — done ✓
All `DataAdapter` methods (32 of them) ported against Drizzle. Mock
adapter stays as the default for the demo / offline iteration path.
`NEXT_PUBLIC_DATA_SOURCE=neon` toggles to the real adapter.

### B4 · Persistence write paths — done ✓
Server actions live under `app/actions/`:
- `polls.ts` — `submitPollVote`, `addPollOption`, `reactToPollOption`,
  `createPoll`, `closePoll`, `reopenPoll`, `archivePoll`,
  `promotePollOption`
- `charter.ts` — `proposeCharter`, `approveCharter`, `createCharterEntry`
- `league-settings.ts` — `getLeagueSettings`, `updateLeagueSettings`,
  `recomputeLockAt`, `recomputeAllLockTimesForLeague`
- `leagues.ts` — real `createLeague` + `joinLeagueByInviteCode` (idempotent
  via `onConflictDoNothing` on the `(league_id, user_id)` PK)

Each writes via Drizzle, calls `revalidatePath`, and publishes to Ably.

### B5 · Real-time via Ably — done ✓
- Ably free tier signed up; key in `.env.local`
- `lib/ably/server.ts` (REST publish from server actions)
- `lib/ably/client.ts` (singleton browser Realtime client)
- `app/api/ably/token/route.ts` — Auth.js-protected token endpoint that
  signs scoped capability tokens per league membership
- Channel architecture per design (`league:{id}:polls`, `charter`,
  `parlay:{id}:legs`, `roster`, `settings`, plus `nfl:games:week:{id}`)
- Client glue uses `router.refresh()` on receive — simpler than
  TanStack Query cache pokes and "feels alive" enough for the volume

### B6 · Lock-time derivation + slate config — done ✓
- `lib/lock-time.ts` — `computeLockAt(leagueId, nflWeekId)` reads the
  league's slate config + games for the week, returns the earliest
  in-slate kickoff − offset
- `app/actions/league-settings.ts` — `recomputeLockAt`,
  `recomputeAllLockTimesForLeague`. League settings save triggers a
  full 22-week recompute + Ably broadcast on the `settings` channel
- `app/api/cron/refresh-schedule/route.ts` + `vercel.json` — nightly
  09:00 UTC cron that re-pulls ESPN + recomputes every (league, week)
  pair. Protected by `Authorization: Bearer $CRON_SECRET`
- League sheet settings UI replaced — 7-day chip picker + holidays
  toggle + lock-offset preset chips (5/10/15/30/60m) + dirty-state Save
  button. Reads/writes through the server actions

### B7 · League-creation onboarding wizard — done ✓
`/leagues/new` is a 4-step wizard:
1. Name + invite code (auto-generated with regenerate button)
2. Slate days (7-day picker) + holidays toggle
3. Lock offset preset chips
4. Review + Sleeper-import placeholder (deferred to B+)

`createLeague` server action inserts the row + makes the creator owner
+ pre-warms `league_weeks` cache.

### B8 · Supabase → Neon data migration — done ✓
Migration ran 2026-05-15 via `scripts/migrate-to-neon.ts` (since
deleted with the Supabase decom). Snapshot: 19 users, 3 leagues,
20 members, 57 weeks, 53 parlays, 241 legs ported. Auth.js re-links
Google accounts by email on first sign-in (relies on
`allowDangerousEmailAccountLinking: true`).

### B9 · Cutover + decom — code done ✓ ·  3 user-side items remain
- [x] `NEXT_PUBLIC_DATA_SOURCE=neon`
- [x] Smoke-test every flow end-to-end (Playwright + `neon-cutover.spec`)
- [x] Verify login → land on right league with right data
- [x] Magic-link sender swapped Resend → Brevo (Resend free tier didn't
      allow custom-domain sender; Brevo free tier does, 300 emails/day).
      Provider is `Nodemailer` via Brevo SMTP relay
      (`smtp-relay.brevo.com:587`)
- [x] `EMAIL_FROM=hello@degeneratesdashboard.app` configured (domain
      authenticated in Brevo)
- [x] Remove `lib/supabase/`, Supabase middleware bits, `@supabase/*`
      deps. Done — middleware now uses only Auth.js cookies. Auth bridge
      reduced to mock + neon modes. 11 legacy Supabase files / scripts
      deleted from the tree
- [x] `CRON_SECRET` generated and added to `.env.local`
- [ ] **User action:** Add `https://degeneratesdashboard.app/api/auth/callback/google`
      as a redirect URI in the Google OAuth client (keep the localhost one
      too for dev)
- [ ] **User action:** Set the following in Vercel **Production** env:
      `AUTH_URL=https://degeneratesdashboard.app`, `BREVO_SMTP_USER`,
      `BREVO_SMTP_KEY`, `EMAIL_FROM`, `CRON_SECRET`, and confirm
      `DATABASE_URL` + `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` +
      `ABLY_API_KEY` are present
- [ ] **Optional:** Keep Supabase project paused as a 2-week backup
      (already done if not yet deleted; no harm in leaving)

### B10 · Mobile polish — partial ✓
- [x] PeekCard tap variant — touch devices: first tap lifts the lid,
      second tap opens the sheet. Document-click closes the peek so
      tapping another card naturally collapses the first. Desktop hover
      behavior preserved via Tailwind's `group-data-[peeked]` selectors
- [x] iOS zoom-on-focus — magic-link email input bumped to 16px on
      mobile; `inputMode="email"` + `autoCapitalize="off"` +
      `spellCheck={false}` added
- [x] Odds numeric keypad — both leg-input forms use `inputMode="tel"`
      so the mobile keyboard shows numbers + `+/-` access
- [x] Bottom-sheet drag-close — already implemented in
      `components/ui/responsive-sheet/bottom-sheet.tsx` (touch
      listeners with 100px / velocity threshold)
- [ ] **Deferred:** Real-device iOS Safari pass — sheet behavior with
      keyboard open, landscape rotation, exact tap target audit. Needs
      an iPhone to test
- [ ] **Deferred:** PeekCard visual revisit — flagged "not super happy"
      in A12. Subjective; needs design direction (palette? motion?
      reveal mechanic?)

---

## Phase C — Enrichment (post-migration)

Nice-to-haves that need a real DB to cache against. None blocking.

- [x] NFL schedule pull-in (done 2026-05-22 — ESPN public API, free,
      no key). Loader at `scripts/load-nfl-schedule.ts` (CLI) and shared
      lib at `lib/nfl-schedule.ts` (also used by the cron route). Seeds
      `nfl_weeks` (with `kind`) + `nfl_games` (with `scheduled_day` ET
      and `is_holiday_game`) + `nfl_teams` (32 rows hand-curated).
      Production data: 285 games for 2026-2027. Idempotent —
      re-runnable with `--weeks N,N,N` for partial refresh, or
      `--teams-only` to refresh team metadata.
      - **Scope: app-wide, not per-league.** One pull-and-cache job
        feeds all leagues.
      - **Consumer swap follow-up**: `components/week-slate.tsx` still
        reads hardcoded `TEAM_COLOR` / `TEAM_ABBREV` maps. The
        `nfl_teams` table is populated and ready — swap the maps for a
        table read when convenient.

- [x] **Schedule sync + lock-time derivation (flex / postponements / cron) — shipped under B6.**
      Last season's lock-time pain point: locks were a fixed weekly clock
      time, which broke on Thursday openers, holiday games, weather
      postponements, and SNF/MNF flex moves. With a real schedule in
      `nfl_games`, lock-time becomes a derived value that follows the
      data automatically — but only if we keep that data fresh and
      handle the rough edges.

  - **Lock-time derivation:**
    - ```
      lock_at(week, league)
        = MIN(games.kickoff_at WHERE
            games.week_id = week.id
            AND games.kickoff_at IS NOT NULL
            AND (
              games.scheduled_day IN league.slate_days_included
              OR (games.is_holiday_game AND league.slate_include_holidays)
            ))
          − league.lock_offset_minutes
      ```
    - Default `lock_offset_minutes` per league = **10**. Stored on the
      `leagues` row so admins can pick 5 / 10 / 15 / 30 / 60.
    - When *no* in-slate game has a concrete kickoff yet (flex windows
      or fully TBD slate), `lock_at` is **null** → UI shows "Lock time
      TBD — follows the first kickoff once the NFL firms up the slate"
      and submissions stay open. Real-money apps do the same: Sleeper /
      DraftKings show "TBD" until the league marks it. Once any game
      in the slate gains a concrete time, `lock_at` snaps to it.
    - Cache `lock_at` on `league_weeks` (per-league derived row) so
      reads don't re-aggregate `nfl_games` on every request. Recompute
      on every sync run + on slate-setting change.

  - **Per-league slate configuration:**
    The "slate" = the subset of NFL games that count toward the league's
    parlay. Lock-time, leg composition, and grading all derive from it.
    Last season's pain point: locks fired at a fixed Thursday-style
    clock time even though we excluded TNF from the slate by social
    convention, leaving members locked out before Sunday morning. With
    explicit slate config, lock-time naturally follows the first
    *included* game.

    - **Setting:** `leagues.slate_days_included text[] NOT NULL DEFAULT
      '{sun,mon}'`. Values from the enum
      `mon | tue | wed | thu | fri | sat | sun`. Default mirrors the
      typical friend-group convention (excludes TNF so members can
      lock in closer to game time); the league-creation onboarding
      presents the picker explicitly so admins can opt into a
      different slate without hitting a surprise.
    - **Holiday games toggle** (separate from days): `leagues.slate_include_holidays boolean NOT NULL DEFAULT true`.
      Thanksgiving (3 Thursday games), Black Friday, Christmas Day
      (whatever weekday it falls on this year), and any NFL-flagged
      special-event game ride this toggle. Most casual leagues want
      these in — they're a tentpole part of the season — even if
      Thursday is otherwise excluded from the day picker. A game
      counts toward the slate when:
      ```
      scheduled_day(game) IN slate_days_included
        OR (is_holiday_game(game) AND slate_include_holidays)
      ```
    - **Postponement-safe filtering — `nfl_games.scheduled_day`.**
      Storing each game's *originally-scheduled* weekday on the game
      row keeps slate membership stable when `kickoff_at` shifts.
      Example: a Sunday game pushed to Tuesday by a hurricane keeps
      `scheduled_day = 'sun'`, so it stays in slate (assuming Sunday
      is) without admins touching anything. The filter never reads
      the *current* day-of-week from `kickoff_at`. Sync writes
      `scheduled_day` once on game create and never touches it after
      (postponements only update `kickoff_at` + `status`).
    - **Weird NFL day buckets we explicitly handle:**
      - **Black Friday games** — `scheduled_day = 'fri'`,
        `is_holiday_game = true`. Off by default for a Sun+Mon league
        unless the holiday toggle is on (which it is by default — so
        they're in).
      - **Christmas Day** — falls on any weekday year-to-year.
        `is_holiday_game = true` lets them ride the holiday toggle
        regardless of which day they actually land on.
      - **Thanksgiving Thursday triple-header** — three games marked
        holiday, day = Thursday. Ride the holiday toggle.
      - **Saturday late-season games** — `sat` is a regular day in
        the enum but off by default; admins flip it on if their league
        wants those.
      - **Tue / Wed postponement targets** — never the *originally*
        scheduled day in modern NFL, so they never end up in `slate`
        via the day filter. Filter operates on `scheduled_day`, so
        postponements don't accidentally drop games out.
      - **Future NFL Tue / Wed primetime** (hasn't happened but the
        league has hinted at it) — `tue` / `wed` are in the enum so
        admins can opt in if it ever materializes.
    - **Presets exposed in admin UI:**
      - **Sunday + Monday** (default — our case last year):
        `days: sun, mon · holidays: true`. Lock typically lands ~10
        min before Sunday 1pm slate (or earlier when a London
        9:30am ET game is on the card). Includes Thanksgiving / Black
        Friday / Christmas via the holiday flag.
      - **Full week**: `days: thu, fri, sat, sun, mon · holidays: true`
        — every NFL game day counts.
      - **Sunday only** (purist): `days: sun · holidays: false`
      - **Custom**: per-day toggles + holiday toggle.
    - **Why day-of-week, not slot-level granularity:** Sunday has many
      slots (1pm / 4pm / SNF / London 9:30am) but leagues effectively
      always include all of them or none. Slot-level toggles would
      multiply UI complexity for ~0 real demand. Re-evaluate if a
      league actually asks for it.
    - **International game caveat:** London / Germany / São Paulo
      Sunday morning kickoffs (~9:30am ET) are still Sunday games, so
      they're in if Sunday is in. They pull `lock_at` earlier than
      typical weeks — admins should expect this and can bump
      `lock_offset_minutes` higher if 10 min pre-9:30am feels too
      aggressive (which is why Sleeper-style "lock 15 min before
      first kickoff" UX matters per-league).
    - **Filter-not-hide semantics:** Out-of-slate games still appear
      in any "this week's NFL schedule" preview view — they just
      aren't pickable when composing a leg, aren't counted toward the
      parlay, and don't influence `lock_at`. The preview shows them
      grayed-out with a `Not in slate` chip so members can see what
      the league is intentionally skipping.

  - **Per-week slate override (v2, deferred):** Some weeks the
    league might want a one-off ("we'll include the Thanksgiving 12:30
    game this year"). Schema reservation: optional
    `league_week_overrides.slate_days_included text[] NULL` that
    supersedes the league default for that week. Not in MVP — admins
    can adjust the league-wide setting before a special week if needed.

  - **NFL flex-scheduling realities to handle:**
    - **Sunday Night Football flex** — NFL can swap a 1pm/4pm game
      into SNF, typically announced 6-12 days ahead, starting around
      Week 5 (per the current CBA / 2023 expansion). Kickoff *time*
      stays the same; *teams* change. Our lock-time isn't affected
      directly but the game-row's teams need updating.
    - **Monday Night Football flex** — same mechanic, weeks 12-17.
    - **Thursday Night Football flex** — announced 28 days ahead,
      weeks 13-17. If a flex flips the Thursday opener to a Saturday,
      lock-time shifts later.
    - **Late-season Saturday games (weeks 15-17)** — NFL doesn't
      announce these dates until ~6 days out. Treat as TBD until
      confirmed.
    - **Thanksgiving / Christmas / Black Friday** — fixed dates but
      multiple early-window games (12:30 / 4:30 / 8:20 ET).
    - **International games** — London / Germany / São Paulo ~9:30am ET
      Sunday windows. These shift `first_kickoff` *earlier* than the
      typical 1pm slate. Our lock-derivation just picks the MIN
      automatically.
    - **Postponement / cancellation** — weather, force majeure, strike.
      If a game's `kickoff_at` shifts, we recompute. If a previously
      first-kickoff game gets pushed back, `lock_at` slides later —
      which is *member-friendly* (more time to submit). If a game gets
      pulled *earlier* (rare but possible), `lock_at` could move
      sooner — we never retroactively un-lock submissions; if someone
      submitted between the old and new lock, their leg stays valid.

  - **Schedule sync (cron):**
    - **Source:** sportsdata.io (`Schedule` endpoint, ~$19/mo) OR
      ESPN's undocumented public scoreboard JSON OR The Odds API. Pick
      one paid + free fallback. The Sleeper `state/nfl` endpoint
      doesn't include per-game schedule, so it's not enough alone.
    - **Cadence by season state:**
      - **Offseason / preseason:** daily at 4am ET. Catches the May
        schedule release and preseason game additions.
      - **Regular season, Mon–Wed:** every 6h. This window catches
        most flex announcements.
      - **Regular season, Thu–Sun (game days):** hourly. Catches
        weather postponements, kickoff-time tweaks.
      - **Within 24h of any concrete kickoff:** every 15 min. Cheap
        insurance for last-minute moves.
      - Cadence enforced via Vercel Cron (Pro tier needed for sub-daily
        — Free is daily-only) OR an external scheduler (Inngest / GitHub
        Actions / Trigger.dev) calling a `/api/cron/sync-schedule` route.
    - **Diff + audit:** sync run fetches the upstream schedule for the
      current + next NFL week, computes a delta vs stored `nfl_games`
      rows (by stable provider id), upserts changes, and writes an
      `nfl_schedule_changes` audit row per change (`game_id, field,
      old_value, new_value, source, detected_at`). After upserts,
      recompute affected `nfl_weeks.lock_at` and store. If `lock_at`
      shifted, log a notice row league-side (future: push a
      notification — see "Push notifications" item below).
    - **Idempotent + safe-by-default:** sync never *deletes* a game,
      only updates fields or flips a `cancelled` flag. Manual admin
      override via the Drizzle Studio / a tiny `/admin/schedule` page
      for the founder if the feed gets it wrong.

  - **Schema additions (Phase B):**
    - Global (app-wide):
      - `nfl_games.kickoff_at timestamptz NULL` — null = TBD; can shift
        on postponement.
      - `nfl_games.scheduled_day text NOT NULL` — original day-of-week
        (`mon` … `sun`). Written once on game create; never updated.
        Slate filter reads this, not `kickoff_at`, so postponements
        don't change slate membership.
      - `nfl_games.is_holiday_game boolean NOT NULL DEFAULT false` —
        flagged from the API for Thanksgiving / Black Friday /
        Christmas Day / special-event games.
      - `nfl_games.is_time_tbd boolean DEFAULT false` — explicit flag
        (some providers signal this independently of nullability)
      - `nfl_games.status enum('scheduled','postponed','cancelled','final')`
      - `nfl_games.provider_id text NOT NULL` — stable id from the
        source API, used as the diff key
      - `nfl_schedule_changes` audit table
      - **`nfl_teams` table** — global table of all 32 NFL teams. Mock
        components currently hardcode team display names, ESPN logo
        URLs, and primary brand colors in module-level maps
        (`TEAM_ABBREV`, `TEAM_COLOR` in `components/week-slate.tsx`).
        Move to a `nfl_teams` table with at minimum:
        `id text PRIMARY KEY` (ESPN abbreviation: `kc`, `ne`, `bal`…),
        `display_name text` (`Chiefs`, `Patriots`),
        `full_name text` (`Kansas City Chiefs`),
        `logo_url text`,
        `primary_color text` (hex, e.g. `#E31837`),
        `secondary_color text`,
        `conference text` (`AFC` / `NFC`),
        `division text` (`AFC East`, `NFC West`, …).
        Populated by the same schedule-sync cron — teams rarely change,
        but Commanders / Washington Football Team showed the rename
        path matters. ESPN's `/teams` endpoint or sportsdata.io covers
        the metadata. If hot-linking logos becomes unreliable, mirror
        them into our own bucket and point `logo_url` at that.
    - Per-league:
      - `leagues.lock_offset_minutes int DEFAULT 10`
      - `leagues.slate_days_included text[] NOT NULL DEFAULT '{sun,mon}'`
      - `leagues.slate_include_holidays boolean NOT NULL DEFAULT true`
      - `league_weeks` join table: `(league_id, nfl_week_id PRIMARY KEY,
        lock_at_cached timestamptz NULL, lock_at_overridden boolean
        DEFAULT false, lock_at_manual timestamptz NULL,
        updated_at timestamptz)`. `lock_at_cached` is the derived value;
        if `lock_at_overridden = true`, reads return `lock_at_manual`
        instead. Sync recomputes cached values on every run; slate /
        offset edits trigger a recompute for that league's future weeks.
        v2 override slots: `slate_days_included text[] NULL` +
        `slate_include_holidays boolean NULL` here for per-week
        one-offs.

  - **Admin override path:**
    - League admins can override `lock_at` for a single week (e.g.,
      "lock everyone tonight because we agreed to it"). Sets the
      league_weeks row: `lock_at_overridden = true`, `lock_at_manual =
      <chosen timestamp>`. Reads return the manual value; sync stops
      recomputing for that row.
    - Without override, derivation runs every sync.

  - **What the bottom-dock countdown reads:** the page's
    `getLeagueOverview` action returns `lockAt` (and a `lockAtTbd` flag)
    derived per request. Top dock shows "Locks in 5h 12m" or "Lock time
    TBD" depending. The client-side `setInterval(1000)` countdown
    operates off that timestamp; server enforces the actual cutoff at
    submit.

  - **Mock plan:**
    - For now, mock keeps the heuristic Sunday 9:15 ET first-kickoff.
      Phase B introduces realistic per-week kickoff variance via a
      seeded "schedule fixture" (Thu opener week 1, Thanksgiving slate
      week 12, etc.) that lives alongside `global_weeks.json`.
    - The fixture should include 1-2 TBD-kickoff weeks so we can
      exercise the "Lock time TBD" UI before real schedule data lands.

- [ ] **NFL state probe (free / no-auth)** — for driving `seasonState`
      derivation in production we can hit Sleeper's free
      `GET https://api.sleeper.app/v1/state/nfl` endpoint. Returns
      `{ week, season_type ('pre'|'regular'|'post'), season,
      previous_season, season_start_date, leg, league_season,
      league_create_season, display_week }` — exactly the inputs the
      mock scenarios produce by hand. No auth, no API key, no rate-limit
      headache at our 12-friend scale. Lets us defer the heavier
      schedule API (above) until we actually need per-game matchup data;
      `seasonState` alone is cheap.
      - **Scope: app-wide.** Same as the schedule pull-in — one fetch
        feeds the whole app, cached at the global level, not per
        league.
      - Independent of the broader Sleeper-league integration; the
        `/state/nfl` endpoint doesn't touch league/user data.
      - Cache for ~1h in Postgres (or in-memory) to be polite.
      - Same data is also derivable from any sportsdata API if we end
        up paying for one — Sleeper is just the cheapest probe.

- [ ] **Bottom dock — live game stats expand.** The bottom dock owns the
      user's personal surface (their leg). In passive parlay states
      (locked / live / graded / won / lost), tapping the dock expands an
      inline drawer scoped to MY leg. Currently renders a placeholder card
      announcing the upcoming feed; once the NFL/ESPN integration lands,
      populate with:
  - The specific game's live score, quarter, and game clock.
  - Player-stat row matched to the user's leg (e.g., "Jalen Hurts ATD —
    0 ATD so far · 47 rush yds · 12 carries"), driven by the leg→player
    matcher used for auto-grading.
  - On-pace / off-pace tint mirroring the top-dock live variant.
  - Skeleton when data is loading; "Game starts in Xh" pre-kickoff.
  - **Why personal, not league-wide:** the top-dock live variant already
    surfaces the league-wide tally. The bottom dock zooms in on the
    viewer's own game so the two docks aren't redundant.
  - **Data deps:** same as the top-dock live variant — NFL schedule +
    game state API + leg-to-game/player matcher + short-TTL cache.

- [ ] **Top dock — live game stats variant.** The "lay so far" top dock
      (compact strip showing other members' submitted legs while you compose)
      ships now in Phase A with no external data dependency. The high-value
      sibling that pairs with the bottom dock's live tracker is a **live
      NFL-stat top dock** rendered during the `graded` state with pending
      legs.
  - **Compact**: scrollable row of per-member chips, each showing the
    leg's live game state: `Gibbs 47/75 rush yds · 14:22 Q3` or
    `Bears -3.5 · Bears 17–10 · 04:13 Q4`. Color-coded by current trajectory
    (on pace = cyan, off pace = pink, settled = filled).
  - **Expanded** (tap): full leg-by-leg breakdown with player image / team
    logo, line context, scoring play history.
  - **Data deps**:
    - NFL schedule + game state from The Odds API or sportsdata.io
    - Leg-to-game / leg-to-player matcher (regex first, AI fallback) — same
      infra as auto-grading
    - Cache live scores in Postgres with short TTL (~30s) to stay under
      free-tier rate limits
  - **Why post-cutover**: requires the schema + caching layer that comes
    with Neon, plus the API picked in the schedule task above.
- [ ] DraftKings lines panel — see lines for current week's games
- [ ] Result auto-grading (sports-data API matches leg descriptions to outcomes; AI fills gaps)
- [ ] Onboarding polish (new friend joins via invite link → smooth first run)

- [ ] **League-creation onboarding — slate + lock-offset picker.**
      Today the `app/leagues/new/page.tsx` flow only collects a league
      name. With per-league slate config + a tighter lock-offset
      default, the admin needs to set both before kickoff or they'll
      hit surprises. Walk them through it during creation rather than
      burying it in settings.
  - **Step 1 — Name** (existing) — league name.
  - **Step 2 — Slate** — preset picker with the four common configs
    (Sunday + Monday default, Full week, Sunday only, Custom). For
    Custom, render the per-day toggle row (Mon / Tue / Wed / Thu / Fri
    / Sat / Sun — Tue / Wed off by default since the NFL hasn't put
    games there outside postponements). Beneath the day toggles, a
    separate **Include holiday games** switch (on by default) covers
    Thanksgiving / Black Friday / Christmas Day regardless of the
    day-of-week toggles. Below the picker, a live preview line:
    *"Your weekly lock will land ~12:50 PM ET on a typical Sunday;
    Thanksgiving Thursday games count via Holiday Games."* Recompute
    as the admin toggles. For "Full week", preview reads *"Lock
    follows Thursday 8:05 PM ET when TNF is on the card"* — explicit
    so they know the trade-off.
  - **Step 3 — Lock offset** — numeric stepper with chips
    (5 / 10 / 15 / 30 / 60 min). Tooltip explains why: "Pads
    submission window so members aren't shut out the instant kickoff
    rolls in." Default 10. Lives alongside the slate picker since the
    same preview line responds to it.
  - **Step 4 — Confirm** — summary card recap + Create.
  - **Settings parity:** the same picker UI lives at
    `/leagues/[id]/settings` (admin-only) so a league can adjust
    later. Edits to slate / offset trigger a recompute of all
    `league_weeks.lock_at_cached` rows for that league (idempotent —
    the next scheduled sync would catch up anyway, but a manual
    recompute on save makes the change feel instant).
  - **What it doesn't do in MVP:** per-week overrides (deferred), no
    holiday-game carve-outs (those inherit from day-of-week).
- [ ] Push notifications when a league member submits / week locks / results grade

- [ ] **Live-update strategy — polling-first, SSE-upgrade, WS-optional.**
      Multiple surfaces want "real-time" feel: poll vote tallies, parlay
      state (others' leg results + tally), kickoff countdowns, live game
      stats once the NFL feed lands. Research grounded in Vercel /
      Next.js 15 / Neon constraints + what sports/fantasy apps actually
      ship (Sleeper guidance, ESPN hybrid, DK/FD WebSocket).

  - **Per-surface mechanism + cadence:**
    | Surface | Mechanism | Cadence |
    |---|---|---|
    | Poll votes | TanStack Query polling (Phase 1) → SSE channel (Phase 2) | 10-15s while open + on focus |
    | Parlay state (others' legs, tally) | TanStack Query polling, adaptive | 5s during a live game, 60s pre-game, paused offseason |
    | Live game stats (score, quarter, player line) | Polling against `/api/games/[id]/live` with 3-5s server cache | 5-10s while on game screen, paused on blur |
    | Submission deadline countdown | Pure client `setInterval(1000)` off a server-provided ISO `lockAt` | 1s, client only |
    | State transitions (poll closed, leg submitted) | Server Action → `revalidatePath` → other tabs pick up on next poll/focus | On-action + next tick |
    Truth-of-record for lock-state enforcement is always a server check
    at submit time — never trust the client clock for enforcement.

  - **Why not WebSocket out of the gate:** Vercel serverless functions
    cannot host long-lived WS connections (Vercel KB confirms; Ably's
    write-up explains). WS = a separate hosted service (Pusher / Ably /
    Supabase Realtime / Soketi) or leaving Vercel. At 12 users with
    minute-grain interaction, polling is *indistinguishable* from push.

  - **Why SSE over WS for the upgrade:** Next.js Route Handlers + Vercel
    Fluid Compute host SSE natively (5-min function lifetime; client
    auto-reconnects via `EventSource`). No third-party dependency, no
    deployment shape change. Same JSON payload as the polling endpoint,
    so the SSE upgrade is invisible to the UI.

  - **Postgres LISTEN/NOTIFY caveat:** Neon supports `pg_notify` and
    logical replication, but Scale-to-Zero kills idle sessions every
    ~5 min and drops `LISTEN`ers. To run a persistent listener we'd
    disable Scale-to-Zero (loses cost benefit) and host the listener
    process off-serverless. Not worth it at this scale; the SSE route
    can re-query Postgres each tick instead.

  - **Third-party WS (if we ever need it):**
    | Service | Free tier | Notes |
    |---|---|---|
    | Pusher Channels Sandbox | 100 concurrent · 200k msgs/day | Simplest SDK, plenty of headroom for 12 users |
    | Ably free | 200 concurrent · 6M msgs/month | More generous; better reliability semantics |
    | Supabase Realtime | 200 concurrent · 2M msgs/month | Only attractive if Neon → Supabase Postgres migration |
    | Soketi (self-host) | Free | Pair with VPS deploy; Pusher-protocol compatible |

  - **What sports / fantasy apps actually ship:**
    - **Sleeper:** Read-only HTTP API; community guidance "poll every
      1 min during games, 5 min otherwise." Even Sleeper itself
      reportedly lags during peak load — i.e., not truly push at the
      client.
    - **ESPN Fantasy:** Hybrid — server-side scoring with WS/SSE push
      where possible, polling fallback. Snapshots + deltas.
    - **DraftKings / FanDuel:** WebSockets over Kafka, K8s-hosted
      microservices, sub-second odds push. Different scale + money-on-
      the-line latency budget than ours.
    - **Yahoo Fantasy:** "Official scoring updated 8am PT next day";
      live tracker explicitly best-effort. Transport not disclosed.
    Takeaway: real-money books push (every 200ms matters); fantasy apps
    mostly poll. We're squarely on the fantasy side and smaller than
    any of them.

  - **Phasing (recommended ship order):**
    1. **Phase B (now):** TanStack Query everywhere with adaptive
       `refetchInterval` + `refetchOnWindowFocus`. Server Actions +
       `revalidatePath` for cross-tab eventual consistency. One
       `/api/leagues/[id]/state` endpoint with a 3-5s server-side
       cache covering all per-league reads.
    2. **Phase B+ (when polling feels laggy during games):** Add an
       SSE route on the same payload shape. `EventSource` on client
       with auto-fall-back to polling on disconnect.
    3. **Phase C+ (only if we leave Vercel or grow past 12 users):**
       Pusher Sandbox or Ably free; publish from Server Actions / a
       cron-driven score watcher.

  - **What never needs realtime:** deadline countdowns (client tick),
    historical/standings pages, profile/settings/admin, anything during
    the offseason except poll-vote aggregates.

  - **Sources (cited in research synthesis):**
    Vercel KB on WS support, Vercel Fluid streaming limits, Ably "WS
    on Vercel" explainer, Pedro Alonso SSE-in-Route-Handlers,
    HackerNoon Next.js 15 streaming, Neon pg_notify guide + logical
    replication docs, Pusher/Ably/Supabase pricing pages, Sportsfirst
    on Sleeper + ESPN architectures, ESPN public scoring writeups.
- [ ] **League polls — persistence + admin composer + in-season surfacing.**
      Mock UI shipped in Phase A; schema, lifecycle, two-phase derivation,
      and the in-season surfacing pattern are now research-grounded (see
      prior-art notes below) and locked in. Remaining work is the DB layer,
      write actions, admin composer, and the in-season segmented-control
      pagination.

  - **Prior art that informed the design** (Discord native polls 2024,
    Polly / Simple Poll on Slack, Reddit polls via PRAW, GroupMe polls,
    WhatsApp polls, Sleeper league chat polls inferred from forum requests;
    plus Apple Maps / Robinhood / DraftKings for the multi-context dock
    pattern). The two-phase "gather submissions → curate → vote" flow is
    not natively modeled by any mainstream consumer poll app — only civic
    tools (Decidim, AllOurIdeas) model it, always as two linked polls
    with a `parent_poll_id` pointer.

  - **Locked lifecycle states:**
    - `draft` — admin composing; not visible to members
    - `open` — accepting responses; appears in bottom-dock nav queue
    - `closed` — voting locked; results still rendered in top-dock
      expanded list with a `Closed · {date}` chip (Discord "final
      results" treatment). Skipped by the bottom-dock nav.
    - `archived` — hidden from both surfaces; still queryable by id for
      long-tail history reads.
    - Admin `reopen` allowed within ~30 days of close (Polly pattern).

  - **Locked schema** (`polls` table):
    - `id`, `league_id`, `kind` (`'single' | 'open' | 'ranked'` —
      `'multi'` deferred until asked), `status` (lifecycle enum above),
      `title`, `prompt`, `topic` (categorical enum: punishment / payout
      / rules / season / fun / logistics — drives the topic chip in the
      dock)
    - `options` jsonb array of `{id, label, hint?}` — empty for `open`
      polls
    - `max_ranks` int (nullable) — populated only for `ranked` polls.
      Typical value: 3.
    - `is_anonymous` bool — when true the UI hides per-voter picks; the
      viewer still sees their own. Open-text responses are always
      attributed because the text itself is identifying.
    - `parent_poll_id` (nullable FK) — points from a derived vote-poll
      back to the originating submission poll (the two-phase flow).
    - `created_by`, `created_at`
    - `closes_at` (nullable) — optional auto-close. Past this point the
      poll moves to `closed`.
    - `closed_at`, `archived_at` — set on transitions.

    `poll_responses` table — **production should use one unified
    `selections jsonb` column** keyed by poll kind so a single response
    row covers all three kinds (Postgres JSONB-best-practice path: small
    ordered collections don't justify a join table at our scale).
    Concretely:
    ```sql
    poll_id  uuid not null
    user_id  uuid not null
    selections jsonb not null
    -- single:  [{"choice_id": "uuid"}]
    -- open:    [{"text": "..."}]
    -- ranked:  [{"choice_id": "uuid", "rank": 1},
    --           {"choice_id": "uuid", "rank": 2}]
    submitted_at timestamptz default now()
    primary key (poll_id, user_id)  -- upsert on save
    ```
    The mock currently uses a discriminated shape (`choiceId` / `text` /
    `rankings`) for type-clarity in TypeScript; collapse to JSONB on
    the production write path.

  - **Ranked-choice poll kind (`kind = 'ranked'`)** — research-grounded
    decisions for the priority-voting variant (see
    [Nearform RCV mobile writeup](https://nearform.com/digital-community/ranked-choice-voting-the-mobile-challenge/),
    [Polly ranked-order announcement](https://www.polly.ai/blog/ranked-order-point-allocation),
    [Ballotpedia ballot exhaustion](https://ballotpedia.org/Ballot_exhaustion),
    [Civic Design RCV research](https://civicdesign.org/topics/rcv/)):
    - **UI: tap-to-rank with numbered badges.** Voter taps an option to
      assign it the next available rank (1, 2, 3 …). Tapping a ranked
      option unranks it and shifts higher ranks down to fill the gap.
      Hitting `maxRanks` silently refuses further assignments — no
      auto-displacement. Drag is rejected because it's hard one-handed
      and inaccessible (TPGi / Microsoft Mobile Eng guidance).
    - **Tally: plurality-weighted (3 / 2 / 1).** 3 points for a 1st-place
      vote, 2 for 2nd, 1 for 3rd. Tiebreakers: 1st-place count → 2nd-place
      count → alphabetical option label. IRV/Hare is explicitly rejected
      at our 12-voter scale because ballot exhaustion can flip outcomes
      on a single ballot.
    - **Partial ballots allowed.** A voter who ranks only 1 option scores
      3 points for that option, 0 elsewhere. UI cycle naturally prevents
      equal-rank ties.
    - **Results visibility — open trade-off.** Real-election RCV systems
      hide live tallies because partial weighted tallies under non-
      plurality methods can be genuinely misleading. For a 12-friend
      league, visibility > rigor — current mock shows live results like
      single polls. Revisit before shipping: maybe gate full tally
      behind `status === 'closed'` and show only ballot-count
      ("8/12 voted") while open.
    - **Mock demo:** `loser-punishment` was promoted from `single` to
      `ranked` (maxRanks = 3) — sits as the derived child of the closed
      `punishment-ideas` submission poll. Deterministic per-member
      ballot via `seededRng(memberId::pollId)` so the tally stays stable.

  - **What's already shipped (mock, Phase A):**
    - `lib/data/mock-polls.ts` — 10 example polls covering all three
      kinds: 6 `single`, 3 `open` (rule proposals, punishment ideas
      [closed], season MVP), 1 `ranked` (loser-punishment, 3-rank cap).
    - Demo two-phase flow: `punishment-ideas` (open kind) is `closed`
      with `closedAt` set; `loser-punishment` (ranked) has its
      `parentPollId` pointing back to it. The derived child poll shows
      a `Curated from: Punishment ideas` hint that carries the chain
      context without needing the source visible.
    - **Closed polls are hidden from members** in both docks. The data
      lives in fixtures (and will live in the DB) but the active
      offseason UI only surfaces `status === 'open'` polls. Rationale:
      they cluttered the "what needs my attention" view; their value is
      historical, not action-driving. See "history-view sheet" under
      the remaining-work list for the planned surfacing.
    - Deterministic per-league synthesis (`seededRng(leagueId)`) so
      screenshots stay stable across reloads.
    - `<OffseasonPollsHub>` client component owns vote state for the
      session — both docks render off the same `useState` so saves
      reflect instantly in both surfaces. Vote overlay merges on top of
      fixture history.
    - Top dock compact: `{open} open · {voted}/{open} voted ·
      {next-kickoff}`. Tapping any row in the expanded list jumps the
      bottom dock to that poll.
    - Bottom dock: topic chip, "N of openCount" counter, prev/next
      arrows, prompt, kind-specific input (option pills for `single`,
      textarea for `open`, tap-to-rank pills with numbered badges +
      "Your ranking" summary for `ranked`), `Skip` + `Save/Update`
      action row (Save disabled unless dirty). Empty state when
      everything's closed.

  - **Remaining work — Phase B/C:**
    - **Server actions:** `submitPollResponse(pollId, vote)`,
      `createPoll(...)`, `closePoll(pollId)`, `reopenPoll(pollId)`,
      `archivePoll(pollId)`, `derivePollFrom(submissionPollId, ...)`.
      Replace the hub's local `recordVote` callback with the real
      submit action; use `revalidatePath` for cross-tab consistency
      (optimistic update is already in place).
    - **Admin composer:** `+ New poll` CTA visible to owners/admins.
      Sheet-based composer with kind picker, prompt textarea, dynamic
      options array (for `single`), optional `closes_at`, optional
      `is_anonymous`. From a `closed` open-poll, an extra "Curate into
      vote poll" action seeds a new `single` poll's options from the
      submitted texts (admin trims/edits before publishing).
    - **Validation:** ≥2 options for `single`, ≤200ch prompt, ≤80ch
      per option, no overall cap on open polls per league (revisit if
      it becomes a problem).
    - **Anonymity default:** per-poll opt-in. Default is non-anonymous
      since social accountability is part of the league's vibe.
      Open-text polls render the author name on each response.
    - **History-view sheet (closed polls).** Closed polls are hidden
      from both docks today — they cluttered the active view. Add a
      dedicated read-only sheet that lists them with full results:
      single-choice → final vote bars, ranked → final tally, open →
      every submission with author. Entry points:
        - Tappable derivation hint on a derived child poll
          (`Curated from: Punishment ideas →`) opens the sheet
          scrolled to that source poll. This is the highest-value path
          — voters often want to see what was submitted before they
          vote on the curated shortlist.
        - A subtle `Poll history ({N})` link in the top dock expanded
          footer or in the admin menu.
      Includes a "Reopen" admin action (Polly's 30-day window).

  - **In-season surfacing — segmented control (Apple Maps pattern):**
    The in-season dual-dock currently only carries the parlay flow.
    Polls become addable in-season via a segmented control at the top of
    *both* docks:
    ```
    [ Parlay  ·  Polls·1• ]
    ```
    - Default page: `Parlay` (current behavior — week status above, your
      leg below).
    - `Polls·N` page: same offseason variant as today (results aggregate
      up top, single-poll editor at the bottom). `N` counts `open` polls;
      a tiny dot appears when at least one is unvoted by the viewer
      (Sleeper / Discord / Slack unread-dot precedent).
    - Selecting a segment flips *both* docks in sync — the top swaps
      from week → poll results, the bottom swaps from your leg → poll
      editor. Behaves like one paginated surface, not two.
    - Off-/preseason: segmented control hidden, `Polls` is the sole
      page (no `Parlay` to switch to). The experience we have today
      becomes the special case.
    - Implementation: lift the segmented-control state up to a new
      hub that wraps both `<LeagueTopDock>` + `<CurrentWeekDock>` (or
      replace them with a unified `<DualDock>` that owns paging).

  - **Lifecycle in-season:** polls can be created at any point. Admins
    can flag them as `season-recap-only` (a sub-status on `closed`) to
    keep them hidden from the in-season `Polls` page but still
    accessible during the next off-/preseason.

- [ ] **Sleeper integration** — bootstrap a new league here from an existing
      Sleeper league. Speed up onboarding for friend groups already on Sleeper
      and pull free metadata (avatars, display names, optional historical
      standings) without typing it all in.
  - **API constraints (from sleeper docs research):**
    - Public read-only. No OAuth, no API key. Just hit endpoints by ID.
    - **No email / phone / real name** is exposed — Sleeper keeps that
      private. So Sleeper does NOT replace our auth; users still sign in
      via Auth.js + Google. Sleeper just provides identity stubs.
    - User profile fields available: `user_id`, `username`, `display_name`,
      `avatar` (CDN ID).
    - League fields: `name`, `season`, `status`, `total_rosters`, `settings`,
      `scoring_settings`, `previous_league_id`, `avatar`.
    - Year-over-year is a **linked list** via `previous_league_id`. Each
      season Sleeper mints a new league_id; walk back to find prior years.
    - Rate limit: ~1000 calls/min (we're nowhere close at 12-friend scale).
    - Avatars CDN: `https://sleepercdn.com/avatars/<id>` (or `/thumbs/<id>`).
  - **Primary endpoints:**
    - `GET /v1/user/<username_or_id>` — resolve user
    - `GET /v1/league/<league_id>` — league metadata
    - `GET /v1/league/<league_id>/rosters` — rosters w/ `owner_id` + W-L stats
    - `GET /v1/league/<league_id>/users` — full user list for a league
    - `GET /v1/user/<user_id>/leagues/nfl/<season>` — used for the
      "is this league yours?" membership check
  - **Schema additions (Phase B touch-up):**
    - `users.sleeperUserId` (text, nullable, indexed)
    - `users.sleeperUsername` (text, nullable)
    - `leagues.sleeperLeagueId` (text, nullable) — current-season Sleeper id
    - `leagues.sleeperHistoryChain` (jsonb array of `{season, leagueId}`,
      nullable) — populated lazily by walking `previous_league_id`
    - `league_members.sleeperUserId` (text, nullable) — set on stub members
      created during import; cleared/merged when the real user claims the seat
  - **Onboarding flow:**
    1. Admin clicks "Import from Sleeper" on the new-league flow
    2. Pastes league ID (or username + season → we resolve)
    3. We fetch league + rosters + users; show a preview ("12 members,
       Sammy / Cody / …, season 2025-2026")
    4. Admin confirms → we create the league + 12 stub `league_members`
       rows tagged with their `sleeper_user_id`, no auth account yet
    5. Admin shares our normal invite link
    6. When a real user signs in (Google), we ask "are you @cody123 from
       Sleeper?" If they confirm, we merge: link `users.sleeperUserId` and
       attach them to the matching stub seat. Otherwise they get their
       own seat and the stub stays unclaimed.
  - **Validation:** to discourage typo'd league IDs, after fetching call
    `/v1/user/<user_id>/leagues/nfl/<season>` for the importing admin's
    Sleeper user_id and verify the league_id is in the array. Skippable
    if the admin doesn't have a Sleeper account.
  - **Historical-standings import (optional, post-MVP):**
    - When admin imports, we offer "also pull last N seasons of standings?"
    - Walk `previous_league_id` until null, hit `/rosters` on each, store
      a season-final summary per member (W-L-T, fpts).
    - Surfaced read-only on a new "All-time" sub-page; not used for our
      parlay-tracking math.
  - **What stays manual:**
    - Email is collected at sign-in (Google).
    - Password isn't applicable (Auth.js Google flow).
    - The original ask of "use Sleeper for email/phone" — not possible.
      Best we can do is map Sleeper identity → our auth identity once they
      sign in for the first time.

- [ ] **Sleeper fantasy bracket overlay** — once a Sleeper league is linked
      (see "Sleeper integration"), display the head-to-head fantasy playoff
      bracket and let our 12 friends predict / vote on each matchup. Rides
      on top of the existing league-polls infrastructure.
  - **Data source.** Sleeper exposes `/v1/league/<id>/winners_bracket` and
    `/v1/league/<id>/losers_bracket` returning matchups with `r` (round),
    `m` (match #), `t1`, `t2` (roster IDs), `t1_from`/`t2_from` (which match
    each side advanced from), `w` / `l` (resolved winner/loser once the
    week's scores settle). Per-week scores from `/matchups/<week>` slot in
    for the live progress.
  - **Bracket UI.** Visual bracket sub-page on the league page during the
    Sleeper playoff weeks (typically league weeks 14-17 — the *Sleeper*
    playoff window, distinct from the NFL post-season we already model).
    Renders rounds left-to-right (or top-to-bottom on mobile), each match
    showing the two avatars + team names + live scores once games kick off.
    Final round = league championship.
  - **Voting / pick-em layer.**
    - Each unresolved matchup auto-creates a 2-option poll under the hood,
      reusing the polls schema (kind: `'single'`).
    - Members tap a side per matchup before it locks at first kickoff.
    - After the week settles, we score predictions:
      - +1 per correctly-picked matchup
      - +1 bonus for picking the championship-game winner
      - Tracker leaderboard separate from the parlay leaderboard ("Bracket
        Picks" tab on the standings sheet).
  - **Lifecycle.**
    - Playoff bracket surfaces only when Sleeper's `league.status` reaches
      a playoff week (or our derived check: `current_week >= playoff_start`
      from `league.settings.playoff_week_start`).
    - Pre-bracket (regular Sleeper season): bracket is hidden / shows a
      seed-projection preview based on current standings.
    - Post-bracket: read-only recap with final-round avatars + champion
      crown overlay. Persists in the league's all-time history.
  - **Design notes.**
    - Visually distinct from the NFL parlay flow — different surface,
      different leaderboard. Don't conflate Sleeper picks with NFL legs.
    - Tone matches the existing gold-accent banner used for the NFL post-
      season state, since both are "championship" framing.
    - First-pass MVP can skip the predictions and just *render* the bracket
      with live scores; voting is the v2 hook.

---

## Open decisions

### §1 · Lifecycle data model (resolve in A1)

- **Submission window:** any time before the week's `lock_at` timestamp.
  `lock_at` is **derived**, not stored on `parlays` — it's computed as
  `first_kickoff_of_week − league.lock_offset_minutes` (default 10 min).
  No separate `parlay.deadline` field; the schedule + league setting
  drive it. Detailed handling (flex scheduling / TBD kickoffs / schedule
  changes via cron) lives under the Phase C "Schedule sync +
  lock-time derivation" entry.
- **Per-user leg lifecycle:** `lockedAt = null` → draft (editable); `lockedAt`
  set → locked. Once locked, immutable for the user. Admin can delete a
  leg (forces user to resubmit).
- **Whole-parlay state:** derived from legs.
  - `open` — at least one leg in draft
  - `locked` — all legs locked, no results yet
  - `graded` — at least one leg has a result, not all
  - `won` — all legs have results, no losses (pushes ok)
  - `lost` — all legs have results, at least one loss
- **Total odds:** computed on read from legs. No stored field.
- **What `parlays` table holds:** just the `(league_id, global_week_id)` join
  + timestamps. All other state moves to legs or is derived.

### §2 · Result grading (resolved)

**Auto-grade via sports-data API; AI fallback for free-text player props
the API can't match.** Manual admin override stays available for edge cases.

Schema marker on each leg: `gradedBy: 'manual' | 'auto' | 'ai'` so we can
audit who/what set a result. `gradedAt` timestamps when. Implementation
is Phase C — schema reserves the columns now so Neon doesn't need a
follow-up migration.

### §3 · Auth (resolved)

- Provider: Auth.js v5 + Google OAuth (single provider)
- Why: friends all have Gmail, no password mgmt, polished UX, data lives in
  our own Postgres (vs. Auth0/Clerk where identity lives external)

### §4 · Realtime (RE-RESOLVED 2026-05-15 — Ably)

**Original decision** (Phase A era): skip third-party WS for MVP, use
TanStack Query polling.

**Reversed** because:
- Building the mock made it obvious how much the experience benefits
  from live updates — poll donuts ticking, approval progress bars
  moving, "8 of 12 submitted" refreshing. Polling makes these feel
  delayed even at fast cadences.
- Ably's free tier (200 concurrent connections, 6M msgs/month) covers
  our 2-3 league × 12 friend scale ~100× over. No cost concern at any
  realistic growth.
- Building a WS server on Vercel is the wrong shape (Edge runtime
  doesn't do long-lived connections; Node runtime fights serverless
  cold starts). Ably solves it cleanly with a hosted broker; we just
  publish from Server Actions.
- Polling fallback stays in place via TanStack Query, so an Ably
  outage degrades gracefully — app keeps working, just slower.

**Architecture lives in Phase B5.** Channel naming + token signing
flow documented there.

**Considered alternatives:**
- Pusher Channels Sandbox — similar pricing tier (100 concurrent /
  200k msgs/day), comparable DX. Ably picked for headroom.
- Supabase Realtime — would've been free given the existing project,
  but we're migrating off Supabase anyway.
- PartyKit (Cloudflare Durable Objects) — great fit for collab apps;
  rejected as overkill for our event-broadcast pattern.
- Self-host Soketi on a VPS — possible but adds an ops surface for
  questionable payoff at our scale.
- SSE on Vercel Fluid — viable for server→client only; we may still
  end up doing some surfaces this way (single-direction, no client
  publish needed) before paying Ably for them.

### §5 · Storage / avatars (resolved)

- Drop avatar uploads. Take avatar URL from Google profile (free) or let
  users paste a URL. No Vercel Blob, no S3.

---

## Notes

- The mock adapter stays after Phase B — it's a permanent dev/demo tool, not transitional.
- `NEXT_PUBLIC_DATA_SOURCE=mock|supabase|neon` toggles which adapter the factory loads.
- The dev scenario toolbar is auto-hidden when `NEXT_PUBLIC_DATA_SOURCE !== 'mock'`.
