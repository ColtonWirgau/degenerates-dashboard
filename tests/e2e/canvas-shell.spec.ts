// The canvas shell: desktop edge-bubble reveals + the mobile dock.
// Uses the same DB-injected Auth.js session as neon-cutover.spec.ts.

import { test, expect, type BrowserContext } from '@playwright/test'
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

async function signIn(context: BrowserContext) {
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
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('edge bubble reveals a panel; Escape puts the card back', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    // Edge chrome mounted: the board bubble is always present.
    const boardBubble = page.getByRole('button', { name: 'board panel' })
    await expect(boardBubble).toBeVisible()
    // The mobile dock is not.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()

    await boardBubble.click()
    await expect(page.locator('.sheet-track.is-slid-right')).toHaveCount(1)
    await expect(page.getByText('Leaderboard', { exact: false }).first()).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.sheet-track.is-slid-right')).toHaveCount(0)
  })

  test('ACTIONS splits into the week’s two verbs', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    // Week 0 has no slate, so no pod at all. Move to a week that does —
    // through the corner door, since the rail no longer carries the week.
    await expect(page.getByRole('button', { name: 'actions' })).toHaveCount(0)
    await page.getByRole('button', { name: /open the week list/i }).click()
    await page.getByRole('button', { name: /Week 1\b/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
      timeout: 15_000,
    })

    const home = page.getByRole('button', { name: 'actions' })
    await expect(home).toBeVisible()
    await home.click()

    // Both verbs spring out, and they come to rest at DIFFERENT heights.
    // A stalled spring leaves all three stacked on the home slot, which
    // is exactly the failure this is here to catch — so assert on the
    // resting positions, not just that the discs exist.
    await expect(page.getByRole('button', { name: 'add leg' })).toBeVisible()

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              new Set(
                [...document.querySelectorAll('[data-action-bubble]')].map(
                  (b) => (b as HTMLElement).style.bottom
                )
              ).size
          ),
        { timeout: 4000 }
      )
      .toBe(3)

    // The home slot became CLOSE, so folding never moves the cursor.
    await expect(page.getByRole('button', { name: 'close' })).toBeVisible()
  })
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('dock is visible, bubbles are not, and a cell opens a sheet', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    const dock = page.getByRole('navigation', { name: 'Main' })
    await expect(dock).toBeVisible()
    await expect(page.getByRole('button', { name: 'board panel' })).toBeHidden()

    await dock.getByRole('button', { name: 'Leaderboard' }).click()
    // The panel arrives as a portaled bottom sheet.
    await expect(
      page.getByRole('dialog').getByText('Leaderboard', { exact: false }).first()
    ).toBeVisible({ timeout: 5_000 })
  })
})
