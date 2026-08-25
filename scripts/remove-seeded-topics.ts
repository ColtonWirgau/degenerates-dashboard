// The six topics the league never wanted.
//
// They arrived with the seed — a Watch Party at "Tom's place", a
// Commissioner vote between two people who have never been in this
// league — and the last pass only closed their polls and unlinked them,
// which left six rows reading "Awaiting" forever under RULES and
// LOGISTICS. Nobody is ever going to fill those in, so they go.
//
// Deleted, not hidden: an entry nobody will ever settle is not a record
// of anything, and leaving it would make HOUSE RULES permanently
// incomplete for no reason. Their polls go too — closed, unreferenced,
// zero votes between them.
//
// Both seasons, because the seed created a row per season. `--dry-run`
// prints without writing.

import './load-env'
import { db } from '@/db/client'
import { charterEntries, polls } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'

/** Charter keys to remove — RULES and LOGISTICS, entire. */
const ENTRY_KEYS = [
  'mid-season-catchup',
  'missed-deadline',
  'tie-breaker',
  'kickoff-meet',
  'trophy',
  'commissioner',
]

/** Their polls, by template key. */
const POLL_TEMPLATES = [
  'mid-season-catchup',
  'miss-deadline-penalty',
  'tie-breaker',
  'kickoff-meet',
  'trophy',
  'commish-2026',
]

async function main() {
  const dry = process.argv.includes('--dry-run')

  const doomed = await db
    .select()
    .from(charterEntries)
    .where(
      and(
        eq(charterEntries.leagueId, LEAGUE),
        inArray(charterEntries.key, ENTRY_KEYS)
      )
    )

  for (const e of doomed) {
    console.log(
      `${dry ? '[dry] ' : ''}✕ entry ${e.season} "${e.label}" (${e.key}) — ${e.status}, value=${JSON.stringify(e.value)}`
    )
  }
  if (!dry && doomed.length > 0) {
    // charter_approvals cascades on entry delete, so nothing is orphaned.
    await db.delete(charterEntries).where(
      inArray(
        charterEntries.id,
        doomed.map((e) => e.id)
      )
    )
  }

  const orphanPolls = await db
    .select()
    .from(polls)
    .where(
      and(eq(polls.leagueId, LEAGUE), inArray(polls.templateKey, POLL_TEMPLATES))
    )

  for (const p of orphanPolls) {
    console.log(`${dry ? '[dry] ' : ''}✕ poll "${p.title}" (${p.templateKey}) — ${p.status}`)
  }
  if (!dry && orphanPolls.length > 0) {
    // poll_options and poll_responses both cascade from polls.
    await db.delete(polls).where(
      inArray(
        polls.id,
        orphanPolls.map((p) => p.id)
      )
    )
  }

  console.log(
    `\n${dry ? 'would remove' : 'removed'} ${doomed.length} entries and ${orphanPolls.length} polls`
  )
  process.exit(0)
}

main()
