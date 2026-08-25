// The preseason ballot arrived pre-loaded with template polls, and the
// league doesn't want to vote on most of them. Several were obviously
// never meant to survive contact with a real league — the Commissioner
// poll asks you to choose between Tom, Andrew and Mike, and two of those
// three have never been in it.
//
// So they're closed rather than deleted: the row stays, and if anyone
// ever wants the question back it's a status flip away. None of them had
// a single vote, so nothing is being thrown away.
//
// Their charter entries are the other half of the job. An entry whose
// approval_rule is 'poll' with its poll closed is an item that can never
// be settled by anything — which is exactly the state Draft format was
// found in. Each one is unlinked and handed to the commish instead, so
// it stays a topic in HOUSE RULES that someone can simply answer.
//
// The punishment poll is untouched. That's the vote the league actually
// wants, and it keeps its own week.

import './load-env'
import { db } from '@/db/client'
import { charterEntries, polls } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'

/** Template keys of the polls the league doesn't need to vote on. */
const RETIRE = [
  'kickoff-meet',
  'mid-season-catchup',
  'miss-deadline-penalty',
  'tie-breaker',
  'trophy',
  'commish-2026',
] as const

async function main() {
  const dry = process.argv.includes('--dry-run')
  const now = new Date()

  for (const templateKey of RETIRE) {
    const [poll] = await db
      .select()
      .from(polls)
      .where(and(eq(polls.leagueId, LEAGUE), eq(polls.templateKey, templateKey)))
      .limit(1)

    if (!poll) {
      console.log(`✗ ${templateKey}: no such poll`)
      continue
    }

    if (poll.status === 'closed') {
      console.log(`· ${templateKey}: already closed`)
    } else {
      console.log(`${dry ? '[dry] ' : ''}→ ${templateKey}: ${poll.status} → closed`)
      if (!dry) {
        await db
          .update(polls)
          .set({ status: 'closed', closedAt: now })
          .where(eq(polls.id, poll.id))
      }
    }

    // Every season's entry pointing at this poll, not just the current
    // one — the seed linked both years at the same row.
    const linked = await db
      .select()
      .from(charterEntries)
      .where(
        and(eq(charterEntries.leagueId, LEAGUE), eq(charterEntries.pollId, poll.id))
      )

    for (const entry of linked) {
      console.log(
        `${dry ? '[dry] ' : ''}   ${entry.season} "${entry.label}": unlink poll, rule ${entry.approvalRule} → commish`
      )
      if (dry) continue
      await db
        .update(charterEntries)
        .set({ pollId: null, approvalRule: 'commish' })
        .where(eq(charterEntries.id, entry.id))
    }
  }

  process.exit(0)
}

main()
