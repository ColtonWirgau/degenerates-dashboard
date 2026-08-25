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

  const restoreTheirs = async () => {
    await clearTheirs()
    for (const r of savedLegs) {
      await pool.query(
        `insert into parlay_legs
           (id, parlay_id, user_id, leg_number, description, odds, result,
            validation_status, validation_message, locked_at, graded_at,
            graded_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [r.id, r.parlay_id, r.user_id, r.leg_number, r.description, r.odds,
         r.result, r.validation_status, r.validation_message, r.locked_at,
         r.graded_at, r.graded_by, r.created_at]
      )
    }
    for (const r of savedKeepers) {
      await pool.query(
        `insert into league_keepers
           (id, league_id, season, user_id, player_name, position,
            round_cost, year_of_keep, declared_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.id, r.league_id, r.season, r.user_id, r.player_name, r.position,
         r.round_cost, r.year_of_keep, r.declared_at]
      )
    }
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
      // Declaring happens in the sheet, like every other verb.
      const board = page.locator('#keeper-board')
      await board.scrollIntoViewIfNeeded()
      await expect(board.getByText('9/12 in')).toBeVisible()

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
      // The catalogue filled the position in; nobody typed "RB".
      await expect(board.getByText('10/12 in')).toBeVisible()

      await page.getByRole('button', { name: /Withdraw/i }).click()
      await expect(board.getByText('Jahmyr Gibbs')).toHaveCount(0, { timeout: 20_000 })
    } finally {
      await restoreTheirs()
    }
  })
})
