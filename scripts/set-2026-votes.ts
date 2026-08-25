// The two votes the league actually wants, with the seeded filler gone.
//
// PUNISHMENT keeps its poll — same row, same ranked format — but every
// option is replaced. The eight it shipped with were template writing
// ("Karaoke night, song picked by the winner"); these are the ones Colton
// and Tyler actually worked out over text, in the order they came up, in
// their own words. Nothing here is invented: where a hint adds detail,
// that detail was in the conversation.
//
// LEAGUE MEDIAN is new. The league wants to decide whether everyone
// plays a second matchup each week against the median score. The
// question is theirs; the three answers are a first draft and worth a
// read before anyone votes.
//
// Safe to run: the punishment poll has zero votes and zero option
// reactions, so nothing is being overwritten that anyone cast.

import './load-env'
import { db } from '@/db/client'
import { charterEntries, nflWeeks, pollOptions, pollResponses, polls } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const SEASON = '2026-2027'

/** Straight from the thread, in the order they were raised. */
const PUNISHMENTS: Array<{ label: string; hint: string }> = [
  {
    label: '25 different Walmarts in a year',
    hint: 'Twenty-five separate stores, over the course of the season.',
  },
  {
    label: 'Joey Chestnut challenge, filmed',
    hint: '76 hot dogs, on camera.',
  },
  {
    label: 'Sent to a brutal event, alone',
    hint: 'We pick the event and the outfit — kids concert, three-hour play. Live video updates throughout, and an essay afterwards written without AI.',
  },
  {
    label: 'Milk Mile',
    hint: 'Four laps of a track, a glass of milk chugged between each one.',
  },
  {
    label: '5K bar hop',
    hint: "We're at a bar 5k away, drinking as much as we can on their tab until they can run there to pay it.",
  },
  {
    label: 'Out-of-season trick-or-treating',
    hint: 'Spring or summer. Noted as awkward for the out-of-state guys.',
  },
  {
    label: '30 days as an influencer',
    hint: 'A post every single day for a month — dishes, parenting, whatever. No skips.',
  },
]

/** The other vote. Question theirs, answers a first draft. */
const MEDIAN = {
  templateKey: 'league-median',
  title: 'Weekly game against the league median',
  prompt:
    "Should everyone play a second matchup each week against the league's median score?",
  options: [
    {
      label: 'Yes — all season',
      hint: 'Every week you get a second W or L, decided by whether you beat the median.',
    },
    {
      label: 'Yes — regular season only',
      hint: 'Median games count toward seeding, then stop once the playoffs start.',
    },
    {
      label: 'No — one matchup a week is enough',
      hint: 'Leave the format alone.',
    },
  ],
}

async function main() {
  const dry = process.argv.includes('--dry-run')

  // ─── Punishment: swap the options ──────────────────────────────────
  const [punishment] = await db
    .select()
    .from(polls)
    .where(and(eq(polls.leagueId, LEAGUE), eq(polls.templateKey, 'loser-punishment')))
    .limit(1)

  if (!punishment) {
    console.log('✗ punishment poll not found')
  } else {
    const cast = await db
      .select()
      .from(pollResponses)
      .where(eq(pollResponses.pollId, punishment.id))
    if (cast.length > 0) {
      console.log(
        `✗ punishment poll already has ${cast.length} votes — refusing to swap its options`
      )
    } else {
      const old = await db
        .select()
        .from(pollOptions)
        .where(eq(pollOptions.pollId, punishment.id))
      console.log(
        `${dry ? '[dry] ' : ''}→ punishment: replacing ${old.length} seeded options with ${PUNISHMENTS.length} real ones`
      )
      for (const p of PUNISHMENTS) console.log(`        · ${p.label}`)
      if (!dry) {
        await db.delete(pollOptions).where(eq(pollOptions.pollId, punishment.id))
        await db.insert(pollOptions).values(
          PUNISHMENTS.map((p, i) => ({
            pollId: punishment.id,
            label: p.label,
            hint: p.hint,
            status: 'approved' as const,
            sortOrder: i,
          }))
        )
        // Ranked over seven options still means a top three.
        await db
          .update(polls)
          .set({ maxRanks: 3, status: 'open' })
          .where(eq(polls.id, punishment.id))
      }
    }
  }

  // ─── League median: a new poll, and somewhere for it to land ───────
  const [week] = await db
    .select()
    .from(nflWeeks)
    .where(and(eq(nflWeeks.season, SEASON), eq(nflWeeks.kind, 'preseason')))
    .limit(1)

  if (!week) {
    console.log(`✗ no preseason week for ${SEASON}`)
    process.exit(1)
  }

  const [existing] = await db
    .select()
    .from(polls)
    .where(and(eq(polls.leagueId, LEAGUE), eq(polls.templateKey, MEDIAN.templateKey)))
    .limit(1)

  if (existing) {
    console.log(`· league-median poll already exists (${existing.status})`)
  } else {
    console.log(`${dry ? '[dry] ' : ''}→ creating poll "${MEDIAN.title}"`)
    for (const o of MEDIAN.options) console.log(`        · ${o.label}`)
    if (!dry) {
      const [created] = await db
        .insert(polls)
        .values({
          leagueId: LEAGUE,
          nflWeekId: week.id,
          kind: 'single',
          status: 'open',
          title: MEDIAN.title,
          prompt: MEDIAN.prompt,
          topic: 'rules',
          optionPolicy: 'closed',
          templateKey: MEDIAN.templateKey,
        })
        .returning()

      await db.insert(pollOptions).values(
        MEDIAN.options.map((o, i) => ({
          pollId: created!.id,
          label: o.label,
          hint: o.hint,
          status: 'approved' as const,
          sortOrder: i,
        }))
      )

      // The vote needs a charter row to settle INTO, or it's a poll that
      // decides nothing — which is how the seeded ones ended up stranded.
      const [entry] = await db
        .select()
        .from(charterEntries)
        .where(
          and(
            eq(charterEntries.leagueId, LEAGUE),
            eq(charterEntries.season, SEASON),
            eq(charterEntries.key, 'league-median')
          )
        )
        .limit(1)

      if (!entry) {
        await db.insert(charterEntries).values({
          leagueId: LEAGUE,
          season: SEASON,
          key: 'league-median',
          label: 'League Median Game',
          category: 'rules',
          approvalRule: 'poll',
          status: 'draft',
          pollId: created!.id,
        })
        console.log('        + charter entry "League Median Game" under RULES')
      }
    }
  }

  process.exit(0)
}

main()
