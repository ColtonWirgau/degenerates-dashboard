// The 2026 draft was settled in person, before this app was finished:
// Monday, August 31st, 8:30pm, at Don Christos. The league voted, the
// answer is known, and there is nothing left for anyone to vote on — so
// the charter should say so and the poll should be shut.
//
// Idempotent: re-running changes nothing once the entries are locked.
// `--dry-run` prints the writes without making them.

import './load-env'
import { db } from '@/db/client'
import { charterEntries, polls } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const SEASON = '2026-2027'

// Set the way every other date in the charter is set — the same
// "Mon, Aug 31 · 8:30pm" shape the draft-date poll's own options use, so
// the settled value reads like the options it was chosen from.
const DECISIONS = [
  {
    key: 'draft-date',
    value: 'Mon, Aug 31 · 8:30pm',
    description: 'Settled by league vote ahead of the season.',
  },
  {
    key: 'draft-location',
    value: 'Don Christos',
    description: 'Settled by league vote ahead of the season.',
  },
] as const

// The vote already happened. Leaving it open would ask the league to
// decide something it has decided.
const CLOSE_POLLS = ['draft-date'] as const

async function main() {
  const dry = process.argv.includes('--dry-run')
  const now = new Date()

  for (const d of DECISIONS) {
    const [entry] = await db
      .select()
      .from(charterEntries)
      .where(
        and(
          eq(charterEntries.leagueId, LEAGUE),
          eq(charterEntries.season, SEASON),
          eq(charterEntries.key, d.key)
        )
      )
      .limit(1)

    if (!entry) {
      console.log(`✗ ${d.key}: no charter entry for ${SEASON}`)
      continue
    }
    if (entry.status === 'locked' && entry.value === d.value) {
      console.log(`· ${d.key}: already settled as "${entry.value}"`)
      continue
    }

    console.log(
      `${dry ? '[dry] ' : ''}→ ${d.key}: ${entry.status}/${JSON.stringify(entry.value)} → locked/"${d.value}"`
    )
    if (dry) continue
    await db
      .update(charterEntries)
      .set({
        value: d.value,
        description: d.description,
        status: 'locked',
        lockedAt: now,
        // It came from a vote — just one held around a table rather than
        // in here. Recording it as manual would lose that.
        source: 'derived-from-poll',
        pendingValue: null,
      })
      .where(eq(charterEntries.id, entry.id))
  }

  for (const templateKey of CLOSE_POLLS) {
    const [poll] = await db
      .select()
      .from(polls)
      .where(and(eq(polls.leagueId, LEAGUE), eq(polls.templateKey, templateKey)))
      .limit(1)

    if (!poll) {
      console.log(`✗ poll ${templateKey}: not found`)
      continue
    }
    if (poll.status === 'closed') {
      console.log(`· poll ${templateKey}: already closed`)
      continue
    }

    console.log(`${dry ? '[dry] ' : ''}→ poll ${templateKey}: ${poll.status} → closed`)
    if (dry) continue
    await db
      .update(polls)
      .set({ status: 'closed', closedAt: now })
      .where(eq(polls.id, poll.id))
  }

  process.exit(0)
}

main()
