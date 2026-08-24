# Degenerates Dashboard

A private parlay-league tracker for a 12-person fantasy football group. Every
week the league assembles **one combined parlay** where each member contributes
exactly **one leg**. The app also runs the league's off-field business — polls
and a season "charter" (draft date, buy-in, punishment, keeper rules) with real
approval thresholds.

> Getting 12 grown men to agree on one draft date without one of them getting
> killed by his wife.

## Stack

| Piece | What |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript |
| Data | Neon Postgres + Drizzle ORM (`db/schema.ts`, migrations in `db/migrations/`) |
| Auth | Auth.js v5, database sessions — Google OAuth + Brevo SMTP magic links |
| Realtime | Ably (`lib/ably/*`) |
| AI | OpenAI — per-leg conflict validation on submit (`lib/openai.ts`) |
| UI | Tailwind v4 (CSS-first, no config file), shadcn primitives, framer-motion |

Dev runs on **port 3001** (`AUTH_URL` is pinned there so magic links match).

```bash
npm install
npm run dev          # http://localhost:3001
npm run build
npx playwright test  # e2e (needs the dev server; it starts one if absent)
```

Required env in `.env.local`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`,
`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `BREVO_SMTP_USER`/`BREVO_SMTP_KEY`,
`EMAIL_FROM`, `ABLY_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`,
`NEXT_PUBLIC_DATA_SOURCE=neon`.

## Data sources

All reads go through the `DataAdapter` seam (`lib/data/adapter.ts`):

- `NEXT_PUBLIC_DATA_SOURCE=neon` → `neon-adapter.ts` (production; real Drizzle)
- `NEXT_PUBLIC_DATA_SOURCE=mock` → `mock-adapter.ts` + fixtures, kept
  permanently as a dev/demo tool with scenario switching

## The NFL schedule

`nfl_teams` / `nfl_games` are seeded from the public ESPN API:

```bash
npx tsx scripts/load-nfl-schedule.ts               # current season + teams
npx tsx scripts/load-nfl-schedule.ts --teams-only  # refresh teams/logos
```

`/api/cron/refresh-schedule` re-pulls nightly (Vercel cron, `Bearer $CRON_SECRET`)
and recomputes each league's lock times.

## Docs

- `ARCHITECTURE.md` — how the app is put together (shell, data flow, lock times)
- `PLAN.md` — the running product/phase plan and status snapshot
