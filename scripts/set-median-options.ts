// The league median vote is a yes or a no.
//
// It shipped with three options and a hint under each — "Yes — all
// season", "Yes — regular season only", "No — one matchup a week is
// enough" — and every word of that was mine, not the league's. The
// question the league asked is whether everyone plays a second matchup
// against the median. That has two answers.
//
// Safe to run: the poll has zero votes and zero option reactions, so
// nothing anyone cast is being thrown away. It refuses if that changes.
// `--dry-run` prints without writing.

import './load-env'
import { db } from '@/db/client'
import { pollOptions, pollResponses, polls } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const OPTIONS = ['Yes', 'No']

async function main() {
  const dry = process.argv.includes('--dry-run')

  const [poll] = await db
    .select()
    .from(polls)
    .where(and(eq(polls.leagueId, LEAGUE), eq(polls.templateKey, 'league-median')))
    .limit(1)

  if (!poll) {
    console.log('✗ league-median poll not found')
    process.exit(1)
  }

  const cast = await db
    .select()
    .from(pollResponses)
    .where(eq(pollResponses.pollId, poll.id))
  if (cast.length > 0) {
    console.log(`✗ ${cast.length} votes already cast — refusing to swap the options`)
    process.exit(1)
  }

  const old = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id))
  for (const o of old) console.log(`  − ${o.label}`)
  for (const label of OPTIONS) console.log(`  + ${label}`)

  if (!dry) {
    await db.delete(pollOptions).where(eq(pollOptions.pollId, poll.id))
    await db.insert(pollOptions).values(
      OPTIONS.map((label, i) => ({
        pollId: poll.id,
        label,
        // No hint. Two words that need explaining aren't yes and no.
        hint: null,
        status: 'approved' as const,
        sortOrder: i,
      }))
    )
  }
  console.log(`\n${dry ? 'would replace' : 'replaced'} ${old.length} options with 2`)
  process.exit(0)
}

main()
