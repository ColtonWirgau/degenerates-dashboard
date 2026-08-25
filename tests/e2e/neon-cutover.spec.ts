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

test('the league opens on the current week — week 0, the charter', async ({ page }) => {
  await openLeague(page)
  // Week 0's identity is now the corner door — the "0" slab that opens
  // the week list, same as every other week.
  await expect(
    page.getByRole('button', { name: /Preseason — open the week list/i })
  ).toBeVisible()

  // Week 0's job is settling what isn't settled, so the open questions
  // lead — out of their categories and onto their own cards.
  await expect(
    page.getByRole('heading', { name: /On the Ballot/i, level: 2 })
  ).toBeVisible({ timeout: 10_000 })

  // And the record of what IS settled sits under it, read from real
  // seeded rows.
  await expect(
    page.getByRole('heading', { name: /The Charter/i, level: 2 })
  ).toBeVisible()
  await expect(page.getByText('$50 · 12 teams · $600 pot')).toBeVisible()
  await expect(page.getByText('Snake + 3rd Rd Reversal')).toBeVisible()
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

  // Nothing about picking a year may go through a server action. Action
  // ids are minted per build, so a tab that outlives one is holding ids
  // the server has never heard of — which is exactly how this used to
  // fail, with an UnrecognizedActionError instead of a season change.
  // The cookie is the browser's to write, so no POST should leave here.
  // A server action is precisely a POST carrying Next-Action; Ably's
  // token calls are POSTs too and have nothing to do with us.
  const actions: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.headers()['next-action']) {
      actions.push(`${r.headers()['next-action']} ${String(r.postData()).slice(0, 120)}`)
    }
  })

  await page.getByRole('button', { name: 'Season and league' }).first().click()
  const other = page.getByRole('button', { name: /2025-2026/ })
  await expect(other).toBeVisible({ timeout: 10_000 })
  // Opening the panel hydrates the slate settings, which is its own
  // action and not what this test is about. The clock starts at the
  // click on a year.
  actions.length = 0
  await other.click()

  // The YEAR changes on the click, before any data for it exists — the
  // masthead is reading the switch, not the server.
  await expect(page.getByRole('button', { name: 'Season and league' }).first()).toContainText(
    '2025',
    { timeout: 1_000 }
  )

  // And what can't be known yet says so rather than showing last
  // season's numbers, until the real week lands.
  await expect(page.getByRole('heading', { name: 'Week 18', level: 1 })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

  expect(actions, `season switch fired a server action: ${actions.join(', ')}`).toEqual([])
})
