/**
 * HOW THE CHARTER IS FILED — the topics, their order, and which entry
 * belongs to which.
 *
 * It lived inside the preseason hub while the hub was the only thing
 * that laid the charter out. It isn't any more: the RULES panel prints
 * the same topics in the same order on the canvas, and two copies of a
 * mapping like this drift the first time someone adds a key to one of
 * them. So it's one module, imported by both.
 *
 * Nothing here knows about React — it's the filing system, not a view.
 */

import type { CharterCategory, CharterEntry } from '@/lib/data/mock-charter'

export type EntryGroup =
  | 'Draft'
  | 'Stakes'
  | 'Trading'
  | 'Playoffs'
  | 'Punishment'
  | 'Rules'
  | 'Logistics'

export const ENTRY_GROUP_ORDER: EntryGroup[] = [
  'Draft',
  'Stakes',
  'Trading',
  'Playoffs',
  'Punishment',
  'Rules',
  'Logistics',
]

export const ENTRY_GROUP: Record<string, EntryGroup> = {
  // Draft — date, format (incl. 3rd-round-reversal mechanic), location
  // and all keeper rules (keeper machinery happens at draft, so it
  // lives here).
  'draft-date': 'Draft',
  'draft-format': 'Draft',
  'draft-location': 'Draft',
  'keeper-slots': 'Draft',
  'keeper-cost': 'Draft',
  'keeper-restrictions': 'Draft',
  'keeper-traded-pick': 'Draft',
  'keeper-deadline': 'Draft',
  'eligible-keepers': 'Draft',

  // Stakes — money in/out
  'buy-in': 'Stakes',
  payouts: 'Stakes',
  'weekly-pot': 'Stakes',
  'dues-tracking': 'Stakes',

  // Trading
  'trade-veto-policy': 'Trading',
  'collusion-process': 'Trading',
  'trade-deadline': 'Trading',

  // Playoffs
  'playoff-format': 'Playoffs',
  'regular-season-length': 'Playoffs',
  'last-place-penalty': 'Playoffs',

  // Punishment / Rules / Logistics
  punishment: 'Punishment',
  'missed-deadline': 'Rules',
  'tie-breaker': 'Rules',
  'mid-season-catchup': 'Rules',
  commissioner: 'Logistics',
  'kickoff-meet': 'Logistics',
  trophy: 'Logistics',
}

/** Which built-in topic maps to which charter category on write. */
export const GROUP_CATEGORY: Record<EntryGroup, CharterCategory> = {
  Draft: 'format',
  Stakes: 'stakes',
  Trading: 'trading',
  Playoffs: 'playoffs',
  Punishment: 'punishment',
  Rules: 'rules',
  Logistics: 'logistics',
}

export function isBuiltInGroup(name: string): name is EntryGroup {
  return (ENTRY_GROUP_ORDER as string[]).includes(name)
}

export function groupFor(entry: CharterEntry): EntryGroup {
  // An entry added by hand carries its group; the seeded ones are known
  // by key. Without the first clause a new "Draft" item would silently
  // file itself under Rules.
  const named = entry.metadata?.group
  if (named && isBuiltInGroup(named)) return named
  return ENTRY_GROUP[entry.key] ?? 'Rules'
}

/**
 * The topic an entry PRINTS under, built-in or one the league invented.
 * Custom entries carry their own name in metadata; everything else is
 * one of the seven.
 */
export function displayGroupFor(entry: CharterEntry): string {
  if (entry.category === 'custom') return entry.metadata?.group ?? 'Custom'
  return groupFor(entry)
}

export interface CharterTopic {
  name: string
  entries: CharterEntry[]
  settled: number
  open: number
}

/**
 * The charter, filed: the seven built-in topics in their fixed order,
 * then anything the league invented, alphabetical. Empty topics don't
 * appear — a heading with nothing under it is a heading about nothing.
 */
export function groupCharter(charter: CharterEntry[]): CharterTopic[] {
  const byName = new Map<string, CharterEntry[]>()
  for (const e of charter) {
    const name = displayGroupFor(e)
    const arr = byName.get(name) ?? []
    arr.push(e)
    byName.set(name, arr)
  }
  const ordered = [
    ...ENTRY_GROUP_ORDER.filter((g) => byName.has(g)),
    ...[...byName.keys()].filter((n) => !isBuiltInGroup(n)).sort((a, b) => a.localeCompare(b)),
  ]
  return ordered.map((name) => {
    const entries = byName.get(name)!
    const settled = entries.filter((e) => e.status === 'locked').length
    return { name, entries, settled, open: entries.length - settled }
  })
}

/** How many items the league still owes an answer on. The rung wears it. */
export function unsettledCount(charter: CharterEntry[]): number {
  return charter.filter((e) => e.status !== 'locked').length
}
