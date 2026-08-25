// Signing in with an email that's in no league.
//
// This happened for real: somebody used a different Google account, got
// redirected to the league-creation wizard, and had no way out — the
// wizard was the only signed-in screen in the app with no header on it,
// so no menu, so no sign-out. "Back" went to `/`, which redirected
// straight back to the wizard. The only escape was clearing cookies.

import { test, expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sessions, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

let pool: Pool
let db: ReturnType<typeof drizzle>
let token = ''
let email = ''

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  db = drizzle(pool)
  email = `e2e-stranger-${randomBytes(4).toString('hex')}@example.com`
  const [stranger] = await db
    .insert(users)
    .values({ email, name: 'Wrong Account' })
    .returning()
  token = randomBytes(32).toString('hex')
  await db.insert(sessions).values({
    sessionToken: token,
    userId: stranger!.id,
    expires: new Date(Date.now() + 24 * 3600 * 1000),
  })
})

test.afterAll(async () => {
  // The session cascades with the user.
  await db.delete(users).where(eq(users.email, email))
  await pool.end()
})

test('a signed-in stranger gets told which account, and a way out', async ({
  page,
  context,
}) => {
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

  await page.goto('http://localhost:3001/')

  // Not the create wizard. A league already exists, so this isn't the
  // founder — it's somebody on the wrong email, and those were being
  // treated as the same situation.
  await expect(page.getByRole('heading', { name: /wrong account/i })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: /new league/i })).toHaveCount(0)

  // WHICH account — the fact that explains the whole thing.
  await expect(page.getByText(email)).toBeVisible()

  // And the way out.
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})
