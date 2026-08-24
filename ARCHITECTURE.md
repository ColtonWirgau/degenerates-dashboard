# Architecture

## Routes

| Route | What |
|---|---|
| `/` | Marketing hero + sign-in dock; signed-in users redirect to their first league |
| `/leagues/new` | 4-step create wizard (name/code → slate days → lock offset → review) |
| `/leagues/[id]` | The league screen — branches on season state (off/preseason → polls + charter hub; in-season → week slate + performance) |
| `/leagues/[id]/weeks/[weekId]` | Week detail; `weekId` in the URL is the **parlay id**. Dispatches on derived `ParlayState` into 5 views |
| `/join/[code]` · `/invite/[token]` | Join by code / accept an emailed invitation |
| `/api/cron/refresh-schedule` | Nightly ESPN re-pull + lock-time recompute |

## The shell (`app/leagues/[id]/layout.tsx`)

League routes render inside a **canvas-reveal shell** ported from RoarTracker
and reskinned in the neon palette. It's a *segment* layout on purpose: the
league id is in the URL so it can fetch panel data per-league, and Next keeps
layouts mounted across navigations within the segment — the chrome holds
perfectly still while only the card content swaps.

```
Masthead                         (on the canvas; holds still)
└── CanvasSheet                  (the reveal engine)
    ├── panels: slate/board/polls (left)  ·  submit (right)
    └── sheet-track
        └── PageSheet            (the transform target)
            ├── AvatarNotch · PanelBubbles · ActionBubble   (edge chrome)
            └── PageSheetCard → .page-sheet-scroll → {children}
MobileDock · LeagueSheetHost     (portaled; outside the transform)
```

**How it works.** Opening a panel doesn't float it over the page — the card
scales back (0.75) toward a top corner, revealing a panel printed on the canvas
beneath. Navigation is a module-scope pub/sub store
(`components/chrome/canvas-store.ts`), not routing.

The edge **bubbles** sit in real holes: `bubble-layout.ts` owns the geometry
(and a dormant split spring), `bite-geometry.ts` traces the whole card
perimeter as one `path()`, and `page-sheet-card.tsx` applies it as a clip-path
via ref on resize and every animation frame. A bubble and its bite can never
drift because they read the same numbers.

Below `lg`, the edge chrome is hidden and the same panels render as portaled
`ResponsiveSheet`s (`components/chrome/panel-reveal.tsx`), driven by the
floating **MobileDock** pill.

### Constraints worth knowing

- **No `backdrop-filter` on `.page-sheet-card`.** It's clip-pathed per frame;
  backdrop resampling is compositor poison, Safari mis-clips it, and it would
  capture `position: fixed` descendants. Panels (not clipped) *are* real glass.
- **Nothing `position: fixed` inside `.page-sheet`** — the transform becomes
  its containing block. Portal it (see `parlay-result-animation.tsx`).
- z-order: bubbles 40 < masthead 50 < portaled sheets 50/60.
- Palette: **blue = good/pass, pink = bad/destructive**, purple = polls. Don't
  introduce new hues.

## Data flow

Reads go through `DataAdapter` (`lib/data/adapter.ts` → `neon-adapter.ts`).
Two composite reads back the pages: `getLeagueOverview` (wrapped in React
`cache()` at `lib/data/league-overview-cached.ts` so layout + page dedupe) and
`getWeekOverview`. Mutations are server actions in `app/actions/*`, each
revalidating its path and publishing to Ably.

`lib/data/week-slate.ts` is a direct-db read model (not on the adapter) that
shapes `nfl_games` + `nfl_teams` into the slate UI's props, flagging each game
`inSlate` per the league's config.

## Lock times — the season's deadline

1. A league configures `slate_days_included` (default sun+mon),
   `slate_include_holidays`, `lock_offset_minutes` (default 10).
2. `lib/lock-time.ts` derives `lockAt = min(in-slate kickoff) − offset` and
   caches it in `league_weeks.lock_at_cached`. Written by league creation, the
   settings action, and the nightly cron.
3. `getCachedLockAt()` reads it (self-healing: computes + persists on a missing
   row; a row with `null` is a legitimate "TBD" and is left alone).
4. It rides on `Parlay.lockAt` → becomes `week.deadline` everywhere, and
   `submitLeg`/`deleteLeg` **enforce it server-side**. `isInSlate()` is shared
   by the derivation and the slate UI so they can't disagree.

**Parlays are created lazily.** `ensureWeekParlay(leagueId, nflWeekId)` is
called from `getLeagueOverview` for the active week only — race-safe via the
`(league_id, nfl_week_id)` unique constraint. Nothing backfills past weeks.

## Still illustrative

Betting odds, in-progress quarter/clock, and which game a leg "belongs to" are
labeled mock in the UI. Real schedule, kickoffs, team colors/logos, statuses and
final scores are live. Odds/live-score provider is not chosen yet; real
leg→game association needs a `parlay_legs.nfl_game_id` column.
