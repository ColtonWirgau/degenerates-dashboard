// End-to-end smoke for the neon-mode cutover. Uses a DB-injected
// Auth.js session (no Google OAuth in CI) to verify the league page
// renders real data and the seeded charter shows up.

import { test, expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sessions, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

const VIEWER_EMAIL = 'coltonwirgau@gmail.com'

let pool: Pool
let db: ReturnType<typeof drizzle>
let sessionToken = ''
let viewerId = ''

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  db = drizzle(pool)
  const viewer = await db
    .select()
    .from(users)
    .where(eq(users.email, VIEWER_EMAIL))
    .limit(1)
  if (!viewer[0]) throw new Error(`No user ${VIEWER_EMAIL}`)
  viewerId = viewer[0].id
  sessionToken = randomBytes(32).toString('hex')
  await db.insert(sessions).values({
    sessionToken,
    userId: viewerId,
    expires: new Date(Date.now() + 24 * 3600 * 1000),
  })
})

test.afterAll(async () => {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken))
  await pool.end()
})

test('neon mode renders the league page with seeded charter', async ({ page, context }) => {
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

  await page.goto('http://localhost:3001/')
  await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

  // Off-season, the card carries the Season Setup doorway; the setup
  // itself lives in the season sheet behind the masthead lockup.
  await expect(page.getByText(/SEASON SETUP/i).first()).toBeVisible({
    timeout: 10_000,
  })

  await page.getByRole('button', { name: 'Season, league and setup' }).first().click()

  // The Buy-in entry renders with the locked value baked into the
  // standard template — proves we're reading real seeded data.
  await expect(page.getByText('$50 · 12 teams · $600 pot')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Snake + 3rd Rd Reversal')).toBeVisible()
})
