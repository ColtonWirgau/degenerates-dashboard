// Tyler runs this league too.
//
// The roles were in the schema from the start (owner | admin | member)
// but nobody had ever been given one: Colton was owner because he made
// the league, and everyone else — Tyler included — was a plain member.
// Which meant every commish-only control in the app was a control with
// exactly one person behind it.
//
// `admin` rather than `owner`: a league has one owner, and only the
// owner can hand out roles. Everything else a commish does — opening
// questions, adding options, writing the charter, settling items — is
// gated on owner-OR-admin, so this is the whole job minus the ability to
// change who else has it.
//
// Idempotent. `--dry-run` prints without writing.

import './load-env'
import { db } from '@/db/client'
import { leagueMembers, users } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const COMMISH_EMAILS = ['tylermartoia@gmail.com']

async function main() {
  const dry = process.argv.includes('--dry-run')

  for (const email of COMMISH_EMAILS) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) {
      console.log(`✗ no user ${email}`)
      continue
    }
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, LEAGUE),
          eq(leagueMembers.userId, user.id)
        )
      )
      .limit(1)

    if (!membership) {
      console.log(`✗ ${email} is not in this league`)
      continue
    }
    if (membership.role === 'admin' || membership.role === 'owner') {
      console.log(`· ${user.name ?? email}: already ${membership.role}`)
      continue
    }
    console.log(
      `${dry ? '[dry] ' : ''}→ ${user.name ?? email}: ${membership.role} → admin`
    )
    if (dry) continue
    // league_members is keyed on (league_id, user_id) — there is no id
    // column, and naming one silently compiles to an empty WHERE.
    await db
      .update(leagueMembers)
      .set({ role: 'admin' })
      .where(
        and(
          eq(leagueMembers.leagueId, LEAGUE),
          eq(leagueMembers.userId, user.id)
        )
      )
  }

  process.exit(0)
}

main()
