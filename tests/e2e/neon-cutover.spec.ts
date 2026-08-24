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
  await expect(page.getByText('Week 0', { exact: true })).toBeVisible()

  // The charter is the week's content, read from real seeded rows.
  await expect(page.getByText('$50 · 12 teams · $600 pot')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Snake + 3rd Rd Reversal')).toBeVisible()
})

test('picking a week swaps the stage without navigating', async ({ page }) => {
  await openLeague(page)
  const url = page.url()

  await page.getByRole('button', { name: 'slate panel' }).click()
  await expect(page.getByText('Preseason', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Week 1\b/ }).first().click()

  await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
  // Single page: the URL never moved.
  expect(page.url()).toBe(url)

  // A week with a slate carries the scope switch and the SUBMIT bubble;
  // week 0 carries neither.
  await expect(page.getByText(/Betting slate · \d+/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'submit' })).toBeVisible()
})

test('the lay is a reveal off the rail, not a modal', async ({ page }) => {
  await openLeague(page)

  // Week 0 has no parlay, so no LAY rung.
  await expect(page.getByRole('button', { name: 'parlay panel' })).toHaveCount(0)

  await page.getByRole('button', { name: 'slate panel' }).click()
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

  // Its last week has a lock time in the past, so it reads LOCKED — the
  // "not everyone's in yet" rule must not reopen it — and the week's one
  // verb is gone, because there's nothing left to submit.
  await expect(page.getByRole('heading', { name: 'Week 18', level: 1 })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText('Locked', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: 'submit' })).toHaveCount(0)

  // Week 0 of a finished season is closed too, even though a preseason
  // week has no lock of its own to be past.
  await page.getByRole('button', { name: 'slate panel' }).click()
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible({
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
