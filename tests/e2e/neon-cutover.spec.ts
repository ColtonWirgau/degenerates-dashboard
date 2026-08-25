// End-to-end smoke for the week-shaped single page. Uses a DB-injected
// Auth.js session (no Google OAuth in CI) to verify that the league's one
// route opens on the current week, that picking a week changes the stage
// without navigating, and that each door leads where it says it does.

import { test, expect, type Page } from '@playwright/test'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sessions, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

const VIEWER_EMAIL = 'coltonwirgau@gmail.com'

let pool: Pool
let db: ReturnType<typeof drizzle>
let sessionToken = ''

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  db = drizzle(pool)
  const viewer = await db
    .select()
    .from(users)
    .where(eq(users.email, VIEWER_EMAIL))
    .limit(1)
  if (!viewer[0]) throw new Error(`No user ${VIEWER_EMAIL}`)
  sessionToken = randomBytes(32).toString('hex')
  await db.insert(sessions).values({
    sessionToken,
    userId: viewer[0].id,
    expires: new Date(Date.now() + 24 * 3600 * 1000),
  })
})

test.afterAll(async () => {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken))
  await pool.end()
})

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
})

/** Land on the league's one route, wide enough for the card-edge rail. */
async function openLeague(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3001/')
  await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
  // The preseason window is open, so the current week is week 0.
  await expect(page.getByRole('heading', { name: 'Preseason', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
}

/** Leave the recap for the season's last week, via the week list. */
async function openWeek18(page: Page) {
  await page.getByRole('button', { name: /open the week list/i }).click()
  await page.getByRole('button', { name: 'Week 18' }).click()
}

test('the league opens on the current week — week 0, the rules', async ({ page }) => {
  await openLeague(page)
  // Week 0's identity is now the corner door — the "0" slab that opens
  // the week list, same as every other week.
  await expect(
    page.getByRole('button', { name: /Preseason — open the week list/i })
  ).toBeVisible()

  // The page is down to the two live things: the dated event, and what
  // the league still has to decide. The settled record — Stakes,
  // Playoffs, Trading and the rest — is a RECORD rather than work, so it
  // reads from the RULES panel now and isn't printed down the page.
  await expect(
    page.getByRole('heading', { name: /^Draft$/i, level: 2 })
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /^Vote$/i, level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Stakes$/i, level: 2 })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: /^Playoffs$/i, level: 2 })
  ).toHaveCount(0)

  // The draft reads as a fixture, not a list of pairs.
  await expect(page.getByText('Don Christos')).toBeVisible()
  await expect(page.getByText('Snake + 3rd Rd Reversal')).toBeVisible()

  // …and the record is one rung away, wearing what's still unanswered.
  await page.getByRole('button', { name: 'rules panel' }).click()
  await page.getByRole('button', { name: /^Stakes —/ }).click()
  await expect(page.getByText('$50 · 12 teams · $600 pot')).toBeVisible()
})

test('the ballot is voted on in place, not behind a sheet', async ({ page }) => {
  await openLeague(page)
  await expect(page.getByRole('heading', { name: /^Vote$/i, level: 2 })).toBeVisible({
    timeout: 10_000,
  })

  // A ballot card opens where it stands and the options come with it. No
  // dialog: pressing a question used to raise a sheet over the page you
  // were already reading, showing you the same question again.
  await page.getByText('League Median Game').click()
  await expect(page.getByText('Cast your vote', { exact: false })).toBeVisible()
  await expect(page.getByText('Yes — all season')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // An open poll is votable whatever the row's provenance. This entry is
  // source='manual' with a live poll attached, and requiring
  // 'derived-from-poll' meant its vote rendered nowhere at all.
  await expect(page.getByText(/be the first to pitch a value/i)).toHaveCount(0)
})

test('picking a week swaps the stage without navigating', async ({ page }) => {
  await openLeague(page)
  const url = page.url()

  await page.getByRole('button', { name: /open the week list/i }).click()
  await expect(page.getByText('Preseason', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Week 1\b/ }).first().click()

  await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
  // Single page: the URL never moved.
  expect(page.url()).toBe(url)

  // A week with a slate carries the slate's own heading and the ACTIONS
  // pod; week 0 carries neither.
  await expect(
    page.getByRole('heading', { name: /Betting slate/i, level: 2 })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'actions' })).toBeVisible()
})

test('the lay is a reveal off the rail, not a modal', async ({ page }) => {
  await openLeague(page)

  // Week 0 has no parlay, so no LAY rung.
  await expect(page.getByRole('button', { name: 'parlay panel' })).toHaveCount(0)

  await page.getByRole('button', { name: /open the week list/i }).click()
  await page.getByRole('button', { name: /Week 1\b/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'parlay panel' }).click()
  // The card slides RIGHT for a left-rail panel — a reveal, not an
  // overlay dropped on top of the page.
  await expect(page.locator('.sheet-track.is-slid-right')).toBeVisible()
  // Everyone in the league gets a row, picked or not.
  await expect(page.getByText('no pick').first()).toBeVisible({ timeout: 10_000 })
})

test('a finished season is closed, not still taking legs', async ({ page }) => {
  await openLeague(page)

  // Switch to the season that already happened.
  await page.getByRole('button', { name: 'Season and league' }).first().click()
  await page.getByRole('button', { name: /2025-2026/ }).click()

  // A finished season opens on how it went, not on a week.
  await expect(page.getByRole('heading', { name: /The Recap/i, level: 1 })).toBeVisible({
    timeout: 20_000,
  })
  await openWeek18(page)

  // Its last week was closed long ago — the "not everyone's in yet" rule
  // must not reopen it.
  await expect(page.getByRole('heading', { name: 'Week 18', level: 1 })).toBeVisible({
    timeout: 20_000,
  })

  // The pod still opens, because a verb that vanishes leaves you
  // wondering where it went. Both of its verbs wear a padlock and refuse
  // to move instead: nothing can be entered, and the games have long
  // since kicked off so it can't be reopened either.
  await page.getByRole('button', { name: 'actions' }).click()
  await expect(page.getByRole('button', { name: 'locked' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'closed' })).toBeDisabled()

  // And a week of a finished season that nobody entered says so in the
  // past tense — "Nobody in", not "Nobody in yet".
  await page.getByRole('button', { name: /open the week list/i }).click()
  await expect(page.getByText('Nobody in', { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  })
})

test('the season and your profile are separate doors', async ({ page }) => {
  await openLeague(page)

  // THE SEASON — years and the roster, off the same right edge as the
  // lockup that opens it.
  await page.getByRole('button', { name: 'Season and league' }).first().click()
  await expect(page.locator('.sheet-track.is-slid-left')).toBeVisible()
  await expect(page.getByRole('button', { name: /2025/ })).toBeVisible({
    timeout: 10_000,
  })
  // The roster lives on the panel itself, not behind a Members door.
  await expect(page.getByText('12 members')).toBeVisible()
  await page.keyboard.press('Escape')

  // YOU — off the card's right edge, and nothing about the league in it.
  await page.getByRole('button', { name: 'Your profile' }).click()
  await expect(page.locator('.sheet-track.is-slid-left')).toBeVisible()
  await expect(page.getByText(VIEWER_EMAIL)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible()
})

test('switching seasons repaints immediately and needs no server action', async ({
  page,
}) => {
  await openLeague(page)

  // Picking a year must not go through a server action. Action ids are
  // minted per build, so a tab that outlives one is holding ids the
  // server has never heard of — which is exactly how this used to fail,
  // with an UnrecognizedActionError instead of a season change.
  //
  // The guard is narrow on purpose. Plenty of legitimate actions take a
  // season as an argument — the recap READS one — so "a season went to
  // the server" proves nothing. What must never come back is an action
  // whose whole payload is a season: that was setViewSeason's signature,
  // and it's the thing whose stale id used to blow the page up.
  const seasonSetOnServer: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'POST' || !r.headers()['next-action']) return
    const body = String(r.postData() ?? '').trim()
    if (/^\["\d{4}-\d{4}"\]$/.test(body)) seasonSetOnServer.push(body)
  })

  await page.getByRole('button', { name: 'Season and league' }).first().click()
  const other = page.getByRole('button', { name: /2025-2026/ })
  await expect(other).toBeVisible({ timeout: 10_000 })
  await other.click()

  // The cookie is written by the BROWSER, so it's already there — no
  // round trip has had time to happen. This is the whole fix in one
  // assertion.
  expect(await page.evaluate(() => document.cookie)).toContain(
    'degens_view_season=2025-2026'
  )

  // And the year changes on the click, before any data for it exists —
  // the masthead is reading the switch, not the server.
  await expect(page.getByRole('button', { name: 'Season and league' }).first()).toContainText(
    '2025',
    { timeout: 1_000 }
  )

  // And what can't be known yet says so rather than showing last
  // season's numbers, until the real thing lands — which for a season
  // that's over is the recap.
  await expect(page.getByRole('heading', { name: /The Recap/i, level: 1 })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

  expect(
    seasonSetOnServer,
    `the season was set through a server action: ${seasonSetOnServer.join(', ')}`
  ).toEqual([])
})
