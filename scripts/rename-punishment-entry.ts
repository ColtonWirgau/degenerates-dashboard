// "The Pick" becomes "Choose your top 3 punishments".
//
// The row IS the vote — it's the one thing on the preseason ballot that
// asks the league to rank something — and "The Pick" named a concept
// rather than saying what to do with it. The card now reads as the
// instruction it is.
//
// LAST PLACE points at it. Its value is the string "See The Pick", which
// is a cross-reference by name, so renaming one without the other leaves
// the book referring to a row that doesn't exist. It becomes "See
// Punishment" — the topic, which is a name that can't go stale.
//
// 2026-2027 only. Last season's book is a record of what the league
// decided and what it called things at the time; editing it to match
// this year's wording would be rewriting history for tidiness.
//
// Idempotent. `--dry-run` prints without writing.

import './load-env'
import { db } from '@/db/client'
import { charterEntries } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

const LEAGUE = '367cb29d-de7a-4b4d-948c-412cdc0a0420'
const SEASON = '2026-2027'

const CHANGES = [
  { key: 'punishment', field: 'label' as const, to: 'Choose your top 3 punishments' },
  { key: 'last-place-penalty', field: 'value' as const, to: 'See Punishment' },
]

async function main() {
  const dry = process.argv.includes('--dry-run')

  for (const c of CHANGES) {
    const [entry] = await db
      .select()
      .from(charterEntries)
      .where(
        and(
          eq(charterEntries.leagueId, LEAGUE),
          eq(charterEntries.season, SEASON),
          eq(charterEntries.key, c.key)
        )
      )
      .limit(1)

    if (!entry) {
      console.log(`✗ ${c.key}: no entry for ${SEASON}`)
      continue
    }
    const current = c.field === 'label' ? entry.label : entry.value
    if (current === c.to) {
      console.log(`· ${c.key}.${c.field}: already "${c.to}"`)
      continue
    }
    console.log(
      `${dry ? '[dry] ' : ''}→ ${c.key}.${c.field}: ${JSON.stringify(current)} → "${c.to}"`
    )
    if (dry) continue
    await db
      .update(charterEntries)
      .set(c.field === 'label' ? { label: c.to } : { value: c.to })
      .where(eq(charterEntries.id, entry.id))
  }

  process.exit(0)
}

main()
