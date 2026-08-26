// The canvas shell: desktop edge-bubble reveals + the mobile dock.
// Uses the same DB-injected Auth.js session as neon-cutover.spec.ts.

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
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
    //
    // Week TWO, not week one. This runs against the real league, and the
    // pod's verbs are a function of the week's state: week 1 has legs in
    // it that were closed by hand, so its pod reads LOCKED / REOPEN and
    // an assertion on ADD LEG fails for a reason that has nothing to do
    // with what this test is about. Week 2 is the first one nobody has
    // touched.
    await page.getByRole('button', { name: /open the week list/i }).click()
    await page.getByRole('button', { name: /Week 2\b/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Week 2', level: 1 })).toBeVisible({
      timeout: 15_000,
    })

    const home = page.getByRole('button', { name: 'actions' })
    await expect(home).toBeVisible()
    await home.click()

    // THREE verbs now — your leg, closing the week, and asking the
    // league something — and they come to rest at DIFFERENT heights. A
    // stalled spring leaves them stacked on the home slot, which is
    // exactly the failure this is here to catch, so assert the resting
    // positions rather than that the discs exist.
    await expect(page.getByRole('button', { name: 'add leg' })).toBeVisible()
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
      .toBe(4)

    // The home slot became CLOSE, so folding never moves the cursor.
    await expect(page.getByRole('button', { name: 'close' })).toBeVisible()
  })

  test('week 0’s pod splits into ADD, ASK and KEEPER', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    const home = page.getByRole('button', { name: 'actions' })
    await expect(home).toBeVisible()
    await home.click()

    // THREE verbs — the charter's two, and the one week 0 asks of every
    // member — at rest on four distinct heights. A stalled spring stacks
    // them on the home slot, which is what this is really checking.
    await expect(page.getByRole('button', { name: 'add', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ask', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'keeper', exact: true })).toBeVisible()
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
      .toBe(4)

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

    // He DOES get the pod, and exactly one verb in it. Week 0 used to
    // arm only for commissioners, because both its verbs were creates —
    // put something on the ballot, ask the league a question. Declaring
    // your KEEPER isn't: it's the one thing week 0 asks of every member,
    // and gating the pod on a role meant the only person who could reach
    // it was the one who didn't need to.
    await page.getByRole('button', { name: 'actions' }).click()
    await expect(page.getByRole('button', { name: 'keeper', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'add', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'ask', exact: true })).toHaveCount(0)

    // …and neither is editing the draft's own details. The pencil is
    // the commish's; the server refuses anyone else regardless.
    await page.getByRole('button', { name: /The draft —.*Opens the room/i }).click()
    await expect(
      page.getByRole('heading', { name: /Don Christos/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('button', { name: /Edit the venue details|Add the venue details/i })
    ).toHaveCount(0)
  })

  test('the hero’s venue half is all door, and the commish alone can edit it', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    // ONE control over the whole half — footage included — not two
    // words floating on a picture that did nothing.
    await expect(page.getByRole('button', { name: /^Draft date/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Draft location/i })).toHaveCount(0)

    const door = page.getByRole('button', { name: /The draft —.*Opens the room/i })
    await expect(door).toBeVisible()
    // It really is the whole half: press the footage, well away from
    // either line of type.
    const box = (await door.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.75)

    await expect(page.locator('.sheet-track.is-slid-left')).toHaveCount(1)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: /Don Christos/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Mon, Aug 31 · 8:30pm')).toBeVisible()

    // The commish gets the pencil.
    await expect(
      page.getByRole('button', { name: /Edit the venue details|Add the venue details/i })
    ).toBeVisible()
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

  test('the disc IS the pod — it splits into the week’s verbs', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    const dock = page.getByRole('navigation', { name: 'Main' })

    // ROOT is the desktop's PANELS. The card-edge rail can't exist on a
    // phone, so its rungs are cells — and SEASON is one of them. WEEKS
    // is NOT: the hero opens with its own "All weeks" on every stage.
    await expect(dock.getByRole('button', { name: 'Weeks' })).toHaveCount(0)
    await expect(dock.getByRole('button', { name: 'Leaderboard' })).toBeVisible()
    await expect(dock.getByRole('button', { name: 'Season and league' })).toBeVisible()

    // The DISC is the desktop's POD. It used to be a verb itself, which
    // left every other verb unreachable on a phone: no ASK, no LOCK, and
    // on week 0 no way to put anything on the ballot at all.
    await dock.getByRole('button', { name: 'Actions' }).click()
    await expect(dock.getByRole('button', { name: 'Your keeper' })).toBeVisible()
    await expect(dock.getByRole('button', { name: 'Add to the book' })).toBeVisible()
    await expect(dock.getByRole('button', { name: 'Ask the league' })).toBeVisible()
    // The panels are gone while the verbs are out — the bar holds still,
    // the faces change.
    await expect(dock.getByRole('button', { name: 'Leaderboard' })).toHaveCount(0)

    // Pressing off the bar folds it home, same gesture as the pod's.
    await page.mouse.click(195, 300)
    await expect(dock.getByRole('button', { name: 'Leaderboard' })).toBeVisible()

    // A week with games holds the week's verbs instead. The weeks list
    // is the hero's door now, not the dock's.
    await page.getByRole('button', { name: /open the week list/i }).first().click()
    await page.getByRole('button', { name: /Week 2\b/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Week 2', level: 1 })).toBeVisible({
      timeout: 15_000,
    })
    await dock.getByRole('button', { name: 'Actions' }).click()
    await expect(dock.getByRole('button', { name: 'Add leg' })).toBeVisible()
    await expect(dock.getByRole('button', { name: 'Lock' })).toBeVisible()
  })

  test('the season sheet carries the book on a phone too', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })

    // No rules cell on the bar — the book went behind the season door,
    // which on a phone is a DOCK CELL. It was the masthead's lockup,
    // which meant the phone header carried the brand, the season AND
    // your face, and the app's own name came out smallest of the three
    // — abbreviated to "DD" beside a neon year twice its size.
    const dock = page.getByRole('navigation', { name: 'Main' })
    await expect(dock.getByRole('button', { name: 'House rules' })).toHaveCount(0)
    await expect(page.getByText('DEGENERATES')).toBeVisible()

    await dock.getByRole('button', { name: 'Season and league' }).click()
    await expect(
      page.getByRole('dialog').getByTestId('rules-book')
    ).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('the commissioner’s hand', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  // Both of these enter things for the PLAIN MEMBER against the real
  // league. They SNAPSHOT whatever he already has, work on an empty
  // slate, and put the originals back — a plain delete would eat real
  // records the first time he had any.
  let savedLegs: Record<string, unknown>[] = []
  let savedKeepers: Record<string, unknown>[] = []

  const clearTheirs = async () => {
    await pool.query(
      `delete from parlay_legs l using users u
        where u.id = l.user_id and u.email = $1`,
      [MEMBER_EMAIL]
    )
    await pool.query(
      `delete from league_keepers k using users u
        where u.id = k.user_id and u.email = $1`,
      [MEMBER_EMAIL]
    )
  }

  const snapshotTheirs = async () => {
    savedLegs = (
      await pool.query(
        `select l.* from parlay_legs l join users u on u.id = l.user_id
          where u.email = $1`,
        [MEMBER_EMAIL]
      )
    ).rows
    savedKeepers = (
      await pool.query(
        `select k.* from league_keepers k join users u on u.id = k.user_id
          where u.email = $1`,
        [MEMBER_EMAIL]
      )
    ).rows
    await clearTheirs()
  }

  /**
   * Put a row back EXACTLY as it was, whatever shape it is.
   *
   * These used to name their columns by hand, and every column added to
   * parlay_legs after that was written got silently dropped on restore —
   * so a suite run quietly stripped `record_only` and `nfl_game_id` off
   * sixteen of the viewer's legs and unlinked twenty-two more. A restore
   * that knows less about the table than the table does is a data-loss
   * bug that only fires on the rows you care most about.
   *
   * Reading the keys off the snapshot means the list can never drift.
   */
  const reinsert = async (table: string, rows: Record<string, unknown>[]) => {
    for (const r of rows) {
      const cols = Object.keys(r)
      await pool.query(
        `insert into ${table} (${cols.map((c) => `"${c}"`).join(',')})
         values (${cols.map((_, i) => `$${i + 1}`).join(',')})
         on conflict (id) do nothing`,
        cols.map((c) => r[c])
      )
    }
  }

  const restoreTheirs = async () => {
    await clearTheirs()
    await reinsert('parlay_legs', savedLegs)
    await reinsert('league_keepers', savedKeepers)
  }

  test('a leg is entered, changed and removed for a member', async ({ page, context }) => {
    await snapshotTheirs()
    try {
      await signIn(context)
      await page.goto('http://localhost:3001/')
      await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
      await page.getByRole('button', { name: /open the week list/i }).click()
      await page.getByRole('button', { name: /Week 1\b/ }).first().click()
      await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
        timeout: 15_000,
      })
      await page.getByRole('button', { name: /Week 1 — open the lay/i }).click()
      await expect(page.getByRole('heading', { name: 'The Lay', level: 2 })).toBeVisible({
        timeout: 10_000,
      })

      await page.getByRole('button', { name: /Enter Joe's leg/i }).click()
      await page.getByPlaceholder(/Chiefs -3\.5/).fill('Bengals ML')
      await page.getByPlaceholder('-110').fill('+140')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Bengals ML')).toBeVisible({ timeout: 20_000 })

      // An edit is a REPLACEMENT, not a second leg: every leg is stamped
      // locked the moment it lands and submitLeg refuses to overwrite a
      // locked one, so the action deletes first — on the server, in one
      // call, so a failed submit can't leave them with nothing.
      await page.getByRole('button', { name: /Change Joe's leg/i }).click()
      await page.getByPlaceholder(/Chiefs -3\.5/).fill('Bengals -3')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Bengals -3')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('Bengals ML')).toHaveCount(0)

      await page.getByRole('button', { name: /Remove Joe's leg/i }).click()
      await expect(page.getByRole('button', { name: /Enter Joe's leg/i })).toBeVisible({
        timeout: 20_000,
      })
    } finally {
      await restoreTheirs()
    }
  })

  test('a keeper is entered, changed and withdrawn for a member', async ({
    page,
    context,
  }) => {
    await snapshotTheirs()
    try {
      await signIn(context)
      await page.goto('http://localhost:3001/')
      await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
      await expect(
        page.getByRole('heading', { name: 'Preseason', level: 1 })
      ).toBeVisible({ timeout: 15_000 })

      // The board is a RECORD — twelve small cards, none of them a form.
      // Assert on its own row rather than on the tally, which anybody
      // else declaring would move.
      const board = page.locator('#keeper-board')
      await board.scrollIntoViewIfNeeded()
      await expect(board.getByText('Keepers', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'actions' }).click()
      await page.getByRole('button', { name: 'keeper', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Your keeper', level: 2 })).toBeVisible({
        timeout: 10_000,
      })

      // A commissioner picks whose. Everyone else has one answer, and a
      // picker offering one option is a control with nothing to choose.
      await page.getByRole('button', { name: /Set Joe Crabb's keeper/i }).click()
      await expect(page.getByRole('heading', { name: /Joe's keeper/i })).toBeVisible()

      // The player is PICKED, not typed — a free-text keeper has no
      // headshot, no position, and "Bijan" is a different player from
      // "Bijan Robinson" as far as the app is concerned.
      await page.getByPlaceholder('Search the NFL').fill('jahmyr')
      const hit = page.getByRole('button', { name: /Jahmyr Gibbs/i })
      await expect(hit).toBeVisible({ timeout: 15_000 })
      await hit.click()
      await page.getByRole('button', { name: 'Declare', exact: true }).click()
      await expect(board.getByText('Jahmyr Gibbs')).toBeVisible({ timeout: 20_000 })

      await page.getByRole('button', { name: /Withdraw/i }).click()
      await expect(board.getByText('Jahmyr Gibbs')).toHaveCount(0, { timeout: 20_000 })
    } finally {
      await restoreTheirs()
    }
  })
})

/**
 * PULL TO REFRESH — and the pull IS the line. Dragging the page down
 * walks an odds ladder from a long shot toward the house's own −110,
 * which locks at the arm point and books on release.
 *
 * Driven with synthetic touches because Playwright's touchscreen only
 * taps, and this gesture is a held drag.
 */
async function touch(page: Page, kind: string, x: number, y: number) {
  await page.evaluate(
    ([k, cx, cy]) => {
      const target =
        document.elementFromPoint(cx as number, cy as number) ?? document.body
      const t = new Touch({
        identifier: 1,
        target,
        clientX: cx as number,
        clientY: cy as number,
      })
      target.dispatchEvent(
        new TouchEvent(k as string, {
          touches: k === 'touchend' ? [] : [t],
          targetTouches: k === 'touchend' ? [] : [t],
          changedTouches: [t],
          bubbles: true,
          cancelable: true,
        })
      )
    },
    [kind, x, y] as const
  )
}

/** The odds board above the page's top edge, or null when it's tucked. */
async function oddsBoard(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[aria-hidden="true"].fixed.inset-x-0.top-0')
    if (!el) return null
    return {
      price: el.querySelector('span.font-display')?.textContent?.trim() ?? null,
      caption: el.querySelector('p')?.textContent?.trim() ?? null,
    }
  })
}

test.describe('the pull', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the line walks, locks on the vig, and books', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    await touch(page, 'touchstart', 195, 300)
    for (const dy of [20, 60, 100]) await touch(page, 'touchmove', 195, 300 + dy)
    await page.waitForTimeout(120)
    const shopping = await oddsBoard(page)
    expect(shopping?.caption).toBe('Shopping the line')
    // A long price, not the locked one — the line hasn't come in yet.
    expect(shopping?.price).toMatch(/^\+/)

    for (const dy of [160, 220, 280]) await touch(page, 'touchmove', 195, 300 + dy)
    await page.waitForTimeout(150)
    expect(await oddsBoard(page)).toMatchObject({
      caption: 'Release to lock',
      price: '−110',
    })

    await touch(page, 'touchend', 195, 580)
    await page.waitForTimeout(180)
    expect((await oddsBoard(page))?.caption).toBe('Booked')
  })

  test('a sideways swipe never tugs the page', async ({ page, context }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    // The roster strip, the keeper picker and the slate's rows are all
    // horizontal scrollers. The axis is committed to once, on the first
    // 6px, so a swipe with real vertical drift stays a swipe.
    await touch(page, 'touchstart', 195, 400)
    await touch(page, 'touchmove', 155, 408)
    await touch(page, 'touchmove', 90, 420)
    await touch(page, 'touchmove', 40, 440)
    await page.waitForTimeout(120)
    expect(await oddsBoard(page)).toBeNull()
    await touch(page, 'touchend', 40, 440)
  })

  test('a pull that starts on the dock belongs to the dock', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('http://localhost:3001/')
    await page.waitForURL(/\/leagues\//, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Preseason', level: 1 })
    ).toBeVisible({ timeout: 15_000 })

    const dockY = await page.evaluate(() => {
      const r = document
        .querySelector('nav[aria-label="Main"]')!
        .getBoundingClientRect()
      return Math.round(r.top + r.height / 2)
    })
    await touch(page, 'touchstart', 195, dockY)
    for (const dy of [40, 120, 240]) await touch(page, 'touchmove', 195, dockY + dy)
    await page.waitForTimeout(120)
    expect(await oddsBoard(page)).toBeNull()
    await touch(page, 'touchend', 195, dockY + 240)
  })
})
