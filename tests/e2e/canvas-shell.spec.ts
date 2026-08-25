// The canvas shell: desktop edge-bubble reveals + the mobile dock.
// Uses the same DB-injected Auth.js session as neon-cutover.spec.ts.

import { test, expect, type BrowserContext } from '@playwright/test'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sessions, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

const VIEWER_EMAIL = 'coltonwirgau@gmail.com'
/** Somebody with no role — the league's controls must not offer to him. */
const MEMBER_EMAIL = 'joecrabb85@gmail.com'

let pool: Pool
let db: ReturnType<typeof drizzle>
let sessionToken = ''
let memberToken = ''

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

  const member = await db
    .select()
    .from(users)
    .where(eq(users.email, MEMBER_EMAIL))
    .limit(1)
  if (!member[0]) throw new Error(`No user ${MEMBER_EMAIL}`)
  memberToken = randomBytes(32).toString('hex')
  await db.insert(sessions).values({
    sessionToken: memberToken,
    userId: member[0].id,
    expires: new Date(Date.now() + 24 * 3600 * 1000),
  })
})

test.afterAll(async () => {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken))
  await db.delete(sessions).where(eq(sessions.sessionToken, memberToken))
  await pool.end()
})

async function signIn(context: BrowserContext, token = sessionToken) {
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: token,
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
    await expect(page.getByText('Board', { exact: false }).first()).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.sheet-track.is-slid-right')).toHaveCount(0)
  })

  test('ACTIONS splits into the week’s two verbs', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    // Week 0's pod holds the CHARTER's verbs, not a week's — so move to a
    // week with a slate, through the corner door since the rail no longer
    // carries the week.
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

  test('week 0’s pod splits into ADD and ASK', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    const home = page.getByRole('button', { name: 'actions' })
    await expect(home).toBeVisible()
    await home.click()

    // The charter's two verbs, at rest on three distinct heights — a
    // stalled spring stacks them on the home slot.
    await expect(page.getByRole('button', { name: 'add', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ask', exact: true })).toBeVisible()
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

    // ADD opens the compose panel on the right — the card slides LEFT.
    await page.getByRole('button', { name: 'add', exact: true }).click()
    await expect(page.locator('.sheet-track.is-slid-left')).toHaveCount(1)
    await expect(page.getByText(/what are we deciding/i)).toBeVisible()
    await expect(page.getByPlaceholder(/side bet ledger/i)).toBeVisible()
    // The topic is a FIELD, not a second feature — a new one is a chip.
    await expect(page.getByRole('button', { name: '+ New' })).toBeVisible()
  })

  test('the season panel carries the year, the roster and the book', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    // The book had its own rung for a while, which was one too many: a
    // buy-in belongs to a YEAR, and this is the panel that answers which.
    await expect(page.getByRole('button', { name: 'rules panel' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Season and league' }).first().click()
    await expect(page.locator('.sheet-track.is-slid-left')).toHaveCount(1)

    const book = page.getByTestId('rules-book')
    await expect(book.getByText('Stakes', { exact: true })).toBeVisible()
    await expect(book.getByText('$50 · 12 teams · $600 pot')).toBeVisible()
    await expect(book.getByText('Week 10')).toBeVisible()
    // DRAFT is the preseason page's hero, not a topic in here.
    await expect(book.getByText('Draft', { exact: true })).toHaveCount(0)

    // One page in, to the line itself — still inside the panel.
    await page.getByRole('button', { name: /^Buy-in —/ }).click()
    await expect(page.getByText('Ratified', { exact: false })).toBeVisible()
    await expect(page.locator('.sheet-track.is-slid-left')).toHaveCount(1)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('a plain member gets neither the pod nor the ballot’s controls', async ({
    page,
    context,
  }) => {
    await signIn(context, memberToken)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    // He votes like everyone else…
    await expect(page.locator('.sheet-track').getByText('Cast Your Vote')).toHaveCount(2)

    // …but putting things ON the ballot is the commish's. Both of these
    // were open to anyone: the add-option control said "(commish
    // approves)" and queued a pitch for promotion, which was two steps
    // and an approval lane to reach somewhere one person could just type.
    await expect(
      page.locator('.sheet-track').getByRole('button', { name: /add an option/i })
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'actions' })).toHaveCount(0)
  })

  test('the hero’s facts open the book at their line', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    // Each fact points at its own line. It used to raise the charter's
    // sheet; now it opens the SEASON panel on that item — a right-hand
    // panel, so the card slides left.
    await page.getByRole('button', { name: /^Draft date/i }).click()
    await expect(page.locator('.sheet-track.is-slid-left')).toHaveCount(1)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Mon, Aug 31 · 8:30pm')).toBeVisible()
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
      page.getByRole('dialog').getByText('Board', { exact: false }).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('the season sheet carries the book on a phone too', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    // No rules cell on the bar — the book went behind the season door,
    // which on a phone is the masthead's lockup.
    const dock = page.getByRole('navigation', { name: 'Main' })
    await expect(dock.getByRole('button', { name: 'House rules' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Season and league' }).first().click()
    await expect(
      page.getByRole('dialog').getByTestId('rules-book')
    ).toBeVisible({ timeout: 5_000 })
  })
})
