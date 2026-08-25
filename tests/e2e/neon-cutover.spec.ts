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
  // the league still has to decide. The settled record — Stakes, Format,
  // Trading and the rest — is a RECORD rather than work, so it reads
  // from the RULES panel and isn't printed down the page.
  //
  // And NEITHER of the two has a heading any more. The draft card introduces
  // itself — a slab with the date on it, the place, the format — and a
  // pink card saying NEEDS YOU over CAST YOUR VOTE doesn't need telling
  // you it's a vote. What's on the page IS the page.
  await expect(
    page.getByRole('heading', { name: /^Draft$/i, level: 2 })
  ).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /^Vote$/i, level: 2 })).toHaveCount(0)
  await expect(page.locator('#preseason-ballot')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /^Stakes$/i, level: 2 })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: /^Format$/i, level: 2 })
  ).toHaveCount(0)

  // The draft reads as a fixture, not a list of pairs. By its control,
  // not its text — the venue's name is also the heading of THE ROOM,
  // which is mounted in its slot whether or not it's open.
  await expect(
    page.getByRole('button', { name: /The draft —.*Don Christos/i })
  ).toBeVisible()
  await expect(page.getByText('Snake + 3rd Rd Reversal')).toBeVisible()

  // …and the record is behind the SEASON door, because a buy-in belongs
  // to a year.
  await page.getByRole('button', { name: 'Season and league' }).first().click()
  await expect(
    page.getByTestId('rules-book').getByText('$50 · 12 teams · $600 pot')
  ).toBeVisible()
})

test('the ballot is voted on in place, not behind a sheet', async ({ page }) => {
  await openLeague(page)
  await expect(page.locator('#preseason-ballot')).toBeVisible({ timeout: 10_000 })

  // The options are THERE — no press to reveal them, no dialog, and no
  // way to put them away. A press used to raise a sheet over the page you
  // were already reading, showing you the same question again; then it
  // was a fold. Both stood between the page's one job and doing it.
  const stage = page.locator('.sheet-track')
  // Both questions say it, in the same words — the ranked one used to
  // say "Rank your top 3", which described the control rather than the
  // job. The chips number themselves as you tap.
  await expect(stage.getByText('Cast Your Vote')).toHaveCount(2)
  // The CHIP, by role — not the bare word. This asserted on any text
  // reading exactly "Yes", which is unique only while nobody has voted:
  // once someone does, the entry row summarises their answer in the same
  // word and the locator matches two things. The claim here is that the
  // control is on the page, so ask for the control.
  const yes = stage.getByRole('button', { name: /^Yes\b/ })
  await expect(yes.first()).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Pressing the question doesn't put it away — there's nothing to press.
  await stage.getByText('League Median Game').click()
  await expect(yes.first()).toBeVisible()

  // An open poll is votable whatever the row's provenance. This entry is
  // source='manual' with a live poll attached, and requiring
  // 'derived-from-poll' meant its vote rendered nowhere at all.
  await expect(page.getByText(/be the first to pitch a value/i)).toHaveCount(0)

  // The ranked question's chips stand on their own: no line telling you
  // to tap them in order.
  await expect(stage.getByText('Choose your top 3 punishments')).toBeVisible()
  await expect(page.getByText(/most preferred first/i)).toHaveCount(0)
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

test('the lay opens from the hero, and is a reveal not a modal', async ({ page }) => {
  await openLeague(page)

  // THE LAY has no rung any more: the week hero's right half IS the lay,
  // drawn, so pressing it is how you open the detail.
  await expect(page.getByRole('button', { name: 'parlay panel' })).toHaveCount(0)

  await page.getByRole('button', { name: /open the week list/i }).click()
  await page.getByRole('button', { name: /Week 1\b/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: /Week 1 — open the lay/i }).click()
  // The card slides LEFT: the lay opens from the hero's RIGHT half, and
  // the card always slides away FROM the thing you pressed. A reveal,
  // not an overlay dropped on top of the page.
  await expect(page.locator('.sheet-track.is-slid-left')).toBeVisible()
  // The slab carries the panel's NOUN, not the week's number — the hero
  // beside it already says that in 60px type.
  await expect(page.getByRole('heading', { name: 'The Lay', level: 2 })).toBeVisible()
  // Everyone in the league gets a row, picked or not.
  await expect(page.getByText('no pick').first()).toBeVisible({ timeout: 10_000 })
})

test('a finished season is closed, not still taking legs', async ({ page }) => {
  await openLeague(page)

  // Switch to the season that already happened.
  await page.getByRole('button', { name: 'Season and league' }).first().click()
  await page.getByRole('button', { name: /2025-2026/ }).click()

  // A finished season opens on how it went, not on a week.
  // The recap's hero is the year and who won it — "The Recap" was a
  // label for the view rather than anything about the season.
  await expect(
    page.getByRole('heading', { name: /2025 recap/i, level: 1 })
  ).toBeVisible({ timeout: 20_000 })
  await openWeek18(page)

  // Its last week was closed long ago — the "not everyone's in yet" rule
  // must not reopen it.
  await expect(page.getByRole('heading', { name: 'Week 18', level: 1 })).toBeVisible({
    timeout: 20_000,
  })

  // The pod still opens, because a verb that vanishes leaves you
  // wondering where it went. Both of its verbs refuse to move instead:
  // nothing can be entered, and the games have long since kicked off so
  // it can't be reopened either.
  //
  // And they say DIFFERENT words. The week's disc used to read SUBMIT
  // when open — the app's own word for entering your leg, sitting
  // directly above ADD LEG — which is how a week got shut with nothing
  // in it. It's LOCK / UNLOCK / LOCKED now, and the leg's dead state is
  // MISSED, which is about you rather than about the week.
  await page.getByRole('button', { name: 'actions' }).click()
  await expect(page.getByRole('button', { name: 'locked' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'missed' })).toBeDisabled()

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
  await expect(
    page.getByRole('heading', { name: /2025 recap/i, level: 1 })
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

  expect(
    seasonSetOnServer,
    `the season was set through a server action: ${seasonSetOnServer.join(', ')}`
  ).toEqual([])
})

test('the wordmark goes home — the current week, without navigating', async ({ page }) => {
  await openLeague(page)
  const url = page.url()

  // Wander off, then press the app's own name.
  await page.getByRole('button', { name: /open the week list/i }).click()
  await page.getByRole('button', { name: /Week 9\b/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Week 9', level: 1 })).toBeVisible({
    timeout: 15_000,
  })

  // It keeps its href — middle click and open-in-new-tab still work —
  // but a plain click must not go to the server. The shell is one page,
  // so home is state, not a fetch.
  let navigated = false
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) navigated = true
  })

  await page.getByRole('heading', { level: 1, name: /DEGENERATES/ }).click()
  await expect(page.getByRole('heading', { name: 'Preseason', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
  expect(page.url()).toBe(url)
  expect(navigated, 'home is state, not a fetch').toBe(false)
  await page.waitForTimeout(800) // let the smooth scroll settle

  // And it clears whatever is open on the way, so home is home.
  await page.getByRole('button', { name: /open the week list/i }).click()
  await page.getByRole('button', { name: /Week 9\b/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Week 9', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Season and league' }).first().click()
  await expect(page.locator('.sheet-track.is-slid-left')).toBeVisible()
  await page.getByRole('heading', { level: 1, name: /DEGENERATES/ }).click()
  await expect(page.locator('.sheet-track.is-slid-left')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Preseason', level: 1 })).toBeVisible({
    timeout: 15_000,
  })
})

test('the venue opens THE ROOM, not its line in the book', async ({ page }) => {
  await openLeague(page)

  // The name of the place is a door to the place — a map, the address,
  // the phone — rather than to what the league decided about it.
  await page.getByRole('button', { name: /The draft —.*Opens the room/i }).click()
  await expect(page.locator('.sheet-track.is-slid-left')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Don Christos/i, level: 2 })
  ).toBeVisible({ timeout: 10_000 })

  // It is the PLACE, not the charter line — the two things you do with
  // a place, and no label over the name saying "venue".
  await expect(page.getByRole('link', { name: 'Google Maps' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Apple Maps' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy the address/i })).toBeVisible()
  await expect(page.getByText('The room', { exact: true })).toHaveCount(0)
})

test('a keeper is declared, amended and withdrawn', async ({ page }) => {
  // This runs against the real league, so it SNAPSHOTS the viewer's own
  // declarations, works on an empty slate, and puts the originals back —
  // a plain delete would eat a real keeper.
  const saved = await pool.query(
    `select k.* from league_keepers k join users u on u.id = k.user_id
      where u.email = $1`,
    [VIEWER_EMAIL]
  )
  const clear = () =>
    pool.query(
      `delete from league_keepers k using users u
        where u.id = k.user_id and u.email = $1`,
      [VIEWER_EMAIL]
    )
  const restore = async () => {
    await clear()
    for (const r of saved.rows) {
      await pool.query(
        `insert into league_keepers
           (id, league_id, season, user_id, player_name, position, sleeper_id,
            round_cost, year_of_keep, declared_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.id, r.league_id, r.season, r.user_id, r.player_name, r.position,
         r.sleeper_id, r.round_cost, r.year_of_keep, r.declared_at]
      )
    }
  }
  await clear()

  try {
    await openLeague(page)

    // The charter said "12 rosters · tap to view" and pointed at a table
    // that had never been written once. This is that table — as twelve
    // small cards, none of which is a form: declaring happens in the
    // sheet off the pod, like every other verb in this app.
    const board = page.locator('#keeper-board')
    await board.scrollIntoViewIfNeeded()
    await expect(board.getByText('Declare yours')).toBeVisible()

    await page.getByRole('button', { name: 'actions' }).click()
    await page.getByRole('button', { name: 'keeper', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your keeper', level: 2 })).toBeVisible({
      timeout: 10_000,
    })

    // PICKED from Sleeper's catalogue, not typed: the pick carries the
    // headshot, the position and the team, so nobody spells a keeper
    // wrong and nobody types "RB".
    await page.getByPlaceholder('Search the NFL').fill('bijan')
    const hit = page.getByRole('button', { name: /Bijan Robinson/i })
    await expect(hit).toBeVisible({ timeout: 15_000 })
    await hit.click()
    await page.getByRole('button', { name: 'Declare', exact: true }).click()
    await expect(board.getByText('Bijan Robinson')).toBeVisible({ timeout: 20_000 })
    await expect(board.getByText('RB', { exact: true }).first()).toBeVisible()

    // Amending EDITS the row — the name is part of the key, so saving a
    // different player as a new row would leave the old one standing.
    await page.getByRole('button', { name: 'Pick a different player' }).click()
    await page.getByPlaceholder('Search the NFL').fill('puka')
    await page.getByRole('button', { name: /Puka Nacua/i }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(board.getByText('Puka Nacua')).toBeVisible({ timeout: 20_000 })
    await expect(board.getByText('Bijan Robinson')).toHaveCount(0)

    await page.getByRole('button', { name: /Withdraw/i }).click()
    await expect(board.getByText('Declare yours')).toBeVisible({ timeout: 20_000 })
  } finally {
    await restore()
  }
})

test('your leg can be changed from the panel that shows it', async ({ page }) => {
  await openLeague(page)
  await page.getByRole('button', { name: /open the week list/i }).click()
  await page.getByRole('button', { name: /Week 1\b/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Week 1', level: 1 })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'actions' }).click()
  await page.getByRole('button', { name: 'your leg' }).click()
  await expect(page.getByText('Locked in')).toBeVisible({ timeout: 15_000 })

  // Whatever is in there — this runs against the real league, so it puts
  // back exactly what it found.
  const box = page.getByPlaceholder(/Chiefs -3\.5/i)
  const odds = page.getByPlaceholder(/-110, \+150/)

  // The panel used to say "open the week and delete your leg first —
  // then resubmit", which described a route that no longer exists: the
  // week page lost its delete when the lay became a panel. The only
  // instruction it gave was one you couldn't follow.
  await page.getByRole('button', { name: /Change it/i }).click()
  await expect(box).toBeVisible({ timeout: 20_000 })

  // And it hands the composer back what you had in it. Reading that off
  // the leg would fail — by the time the form renders, the leg has been
  // deleted and there is nothing left to read — so the text is captured
  // when you press, not looked up after.
  const wasDescription = await box.inputValue()
  const wasOdds = await odds.inputValue()
  expect(wasDescription.length).toBeGreaterThan(0)
  expect(wasOdds.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: /Update|Lock It In/i }).click()
  await expect(page.getByText('Locked in')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(wasDescription).first()).toBeVisible()
})
