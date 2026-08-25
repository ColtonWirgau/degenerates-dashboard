'use server'

// Server actions for charter mutations. Mirror of polls.ts — same
// pattern (adapter write → revalidate → Ably publish).
//
// Wiring step (per surface):
//   1. Find the `setApprovals(...)` and proposal-form submit handlers
//      in offseason-polls-hub.tsx
//   2. Swap to `approveCharter(...)` / `proposeCharter(...)` (this file)
//   3. Drop the optimistic Map — revalidate + real-time push the new state

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'
import type {
  CharterApprovalRule,
  CharterCategory,
  VenueDetails,
} from '@/lib/data/mock-charter'
import { geocode } from '@/lib/geocode'

export async function proposeCharter(
  leagueId: string,
  entryId: string,
  value: string
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const trimmed = value.trim()
  if (!trimmed) return { success: false, error: 'Proposed value is empty' }
  const adapter = await getDataAdapter()
  await adapter.proposeCharterEntry(entryId, me.id, trimmed)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.charter(leagueId), event.charterEntryProposed, {
    entryId,
    userId: me.id,
    value: trimmed,
  })
  return { success: true, error: null }
}

export async function approveCharter(
  leagueId: string,
  entryId: string,
  approved: boolean
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  await adapter.approveCharterEntry(entryId, me.id, approved)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.charter(leagueId), event.charterEntryApproved, {
    entryId,
    userId: me.id,
    approved,
  })
  return { success: true, error: null }
}

export async function createCharter(input: {
  leagueId: string
  season: string
  key: string
  label: string
  category: CharterCategory
  description?: string
  approvalRule: CharterApprovalRule
  threshold?: number
  /** Custom entries carry their display group name: `{ group: 'Side Bets' }`. */
  metadata?: { group?: string }
}) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(input.leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return {
      success: false,
      error: 'Only owners and admins can add charter entries',
    }
  }
  const entry = await adapter.createCharterEntry({
    leagueId: input.leagueId,
    season: input.season,
    key: input.key,
    label: input.label,
    category: input.category,
    description: input.description ?? null,
    approvalRule: input.approvalRule,
    threshold: input.threshold ?? null,
    proposedBy: me.id,
    metadata: input.metadata ?? null,
  })
  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  void publish(channelName.charter(input.leagueId), event.charterEntryProposed, {
    entryId: entry.id,
    userId: me.id,
    value: null,
  })
  return { success: true, error: null, entry }
}

/**
 * Add one item to the charter — with or without a vote attached.
 *
 * Give it options and it becomes a poll the league decides together;
 * give it none and it's a line the commish rules on. Both are the same
 * object in the end (a charter entry), which is why they're one action
 * rather than two features that drift apart.
 */
export async function addCharterItem(input: {
  leagueId: string
  season: string
  /** Which week the poll belongs to, when there is one. */
  nflWeekId: string
  /** Display group. Built-in categories pass their own name. */
  group: string
  category: CharterCategory
  label: string
  approvalRule: CharterApprovalRule
  topic?: 'punishment' | 'payout' | 'rules' | 'season' | 'fun' | 'logistics'
  options?: string[]
}) {
  const { me, error } = await requireCommish(input.leagueId)
  if (error || !me) return { success: false, error: error ?? 'Unauthorized' }

  const label = input.label.trim()
  if (!label) return { success: false, error: 'Give it a name' }
  const options = (input.options ?? []).map((o) => o.trim()).filter(Boolean)
  if (options.length === 1) {
    return { success: false, error: 'A vote needs at least two options' }
  }

  const adapter = await getDataAdapter()

  let pollId: string | null = null
  if (options.length >= 2) {
    const poll = await adapter.createPoll({
      leagueId: input.leagueId,
      nflWeekId: input.nflWeekId,
      kind: 'single',
      title: label,
      prompt: label,
      topic: input.topic ?? 'rules',
      optionPolicy: 'closed',
      options: options.map((o) => ({ label: o })),
      createdBy: me.id,
    })
    pollId = poll.id
  }

  const entry = await adapter.createCharterEntry({
    leagueId: input.leagueId,
    season: input.season,
    // Slugged from the label, salted so two entries can share a name.
    key: `custom:${input.group}:${label}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .concat(`-${Math.random().toString(36).slice(2, 7)}`),
    label,
    category: input.category,
    description: null,
    approvalRule: input.approvalRule,
    threshold: input.approvalRule === 'supermajority' ? 0.75 : null,
    pollId,
    proposedBy: me.id,
    metadata: { group: input.group },
  })

  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  void publish(channelName.charter(input.leagueId), event.charterEntryProposed, {
    entryId: entry.id,
    userId: me.id,
    value: null,
  })
  return { success: true, error: null, entry }
}

/** Owners and admins run the charter; everyone else reads and votes. */
async function requireCommish(leagueId: string) {
  const me = await getCurrentUser()
  if (!me) return { me: null, error: 'Unauthorized' as const }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { me, error: 'Only owners and admins can change the charter' as const }
  }
  return { me, error: null }
}

export async function updateCharter(input: {
  leagueId: string
  entryId: string
  label?: string
  description?: string | null
  approvalRule?: CharterApprovalRule
  metadata?: { group?: string }
}) {
  const { error } = await requireCommish(input.leagueId)
  if (error) return { success: false, error }

  const label = input.label?.trim()
  if (label !== undefined && label.length === 0) {
    return { success: false, error: 'An entry needs a name' }
  }

  const adapter = await getDataAdapter()
  await adapter.updateCharterEntry(input.entryId, {
    ...(label !== undefined ? { label } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.approvalRule !== undefined
      ? {
          approvalRule: input.approvalRule,
          threshold: input.approvalRule === 'supermajority' ? 0.75 : null,
        }
      : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  })
  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  return { success: true, error: null }
}

export async function deleteCharter(
  leagueId: string,
  entryId: string,
  /** The vote attached to it, if any — an entry's poll has no life of
   *  its own, so it goes when the entry does. */
  pollId?: string | null
) {
  const { error } = await requireCommish(leagueId)
  if (error) return { success: false, error }
  const adapter = await getDataAdapter()
  await adapter.deleteCharterEntry(entryId)
  if (pollId) await adapter.deletePoll(pollId)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  return { success: true, error: null }
}

/**
 * Rename a custom topic: the group name lives on each entry's metadata,
 * so renaming one is renaming all of them together.
 */
export async function renameCharterGroup(
  leagueId: string,
  season: string,
  from: string,
  to: string
) {
  const { error } = await requireCommish(leagueId)
  if (error) return { success: false, error }
  const next = to.trim()
  if (!next) return { success: false, error: 'A topic needs a name' }

  const adapter = await getDataAdapter()
  const entries = await adapter.getCharter(leagueId, season)
  const mine = entries.filter(
    (e) => (e.metadata?.group ?? '').toLowerCase() === from.toLowerCase()
  )
  for (const entry of mine) {
    await adapter.updateCharterEntry(entry.id, {
      metadata: { ...entry.metadata, group: next },
    })
  }
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  return { success: true, error: null }
}

/** Delete a custom topic and everything filed under it. */
export async function deleteCharterGroup(
  leagueId: string,
  season: string,
  group: string
) {
  const { error } = await requireCommish(leagueId)
  if (error) return { success: false, error }

  const adapter = await getDataAdapter()
  const entries = await adapter.getCharter(leagueId, season)
  const mine = entries.filter(
    (e) => (e.metadata?.group ?? '').toLowerCase() === group.toLowerCase()
  )
  for (const entry of mine) {
    await adapter.deleteCharterEntry(entry.id)
    if (entry.pollId) await adapter.deletePoll(entry.pollId)
  }
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  return { success: true, error: null, removed: mine.length }
}

/**
 * Save the draft event: what it is, when it is, and everything about
 * the room.
 *
 * Two rows, one form, because it's one event. The DECISIONS —
 * the venue's name, the date — are the entries' `value`, and setting
 * them here is an explicit commissioner override: it settles the row
 * outright rather than opening a proposal, which is the honest shape
 * for a commish correcting the record. Everything else — address,
 * phone, note, the footage — is reference data about the place, and
 * rides in `metadata` on the row it describes.
 *
 * Not `updateCharter`. It geocodes, which is a network call nobody
 * editing a LABEL should pay for; and it MERGES metadata rather than
 * replacing it, because the column is shared — the same shape carries
 * a custom entry's group and the keeper roster, and a blind write
 * would take those with it.
 */
export async function setDraftEvent(input: {
  leagueId: string
  season: string
  /** The `draft-location` row. */
  entryId: string
  /** The `draft-date` row, when the charter has one. */
  dateEntryId?: string | null
  name: string
  address: string
  phone: string
  note: string
  /** ISO `yyyy-mm-dd` and 24h `hh:mm`, straight off the native pickers. */
  date: string
  time: string
}) {
  const { error } = await requireCommish(input.leagueId)
  if (error) return { success: false, error }

  const adapter = await getDataAdapter()
  const entries = await adapter.getCharter(input.leagueId, input.season)
  const entry = entries.find((e) => e.id === input.entryId)
  if (!entry) return { success: false, error: 'That entry no longer exists' }

  const name = input.name.trim()
  const address = input.address.trim()
  const phone = input.phone.trim()
  const note = input.note.trim()

  // Geocode only when the address actually CHANGED. Re-saving a phone
  // number shouldn't send anyone's server a query, and the coordinates
  // we already have are still the right ones.
  const had = entry.metadata?.venue
  let lat = had?.lat
  let lng = had?.lng
  if (address !== (had?.address ?? '').trim()) {
    const point = address ? await geocode([name, address].filter(Boolean).join(', ')) : null
    lat = point?.lat
    lng = point?.lng
  }

  const venue: VenueDetails = {
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(note ? { note } : {}),
    ...(lat != null && lng != null ? { lat, lng } : {}),
  }

  await adapter.updateCharterEntry(input.entryId, {
    metadata: { ...(entry.metadata ?? {}), venue },
    value: name || null,
  })

  // An EMPTY date leaves the date row alone. The pickers seed from
  // whatever prose is already on the books, and that parse can fail —
  // every value in the charter is free text somebody typed. Writing the
  // blank through would mean a commish who opened this to fix a phone
  // number silently unsettled the draft date.
  if (input.dateEntryId && input.date) {
    const dateEntry = entries.find((e) => e.id === input.dateEntryId)
    if (dateEntry) {
      await adapter.updateCharterEntry(input.dateEntryId, {
        metadata: { ...(dateEntry.metadata ?? {}), when: { date: input.date, time: input.time } },
        value: formatWhen(input.date, input.time),
      })
    }
  }

  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  return { success: true, error: null, located: lat != null }
}

/**
 * "2026-08-31" + "20:30" → "Mon, Aug 31 · 8:30pm".
 *
 * The stored value stays PROSE because that's what it has always been —
 * free text somebody typed, printed by the hero and the book alike —
 * and changing that would mean migrating every league's history. The
 * pickers' own values ride in metadata so the editor can round-trip
 * them without re-parsing its own output.
 *
 * Built off the date parts by hand rather than `new Date(...)`, which
 * would read a bare yyyy-mm-dd as UTC and hand back the day before for
 * anyone west of Greenwich.
 */
function formatWhen(date: string, time: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null

  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const head = `${day}, ${month} ${Number(m[3])}`

  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!t) return head
  const h24 = Number(t[1])
  const mins = t[2]
  const suffix = h24 < 12 ? 'am' : 'pm'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${head} · ${h12}:${mins}${suffix}`
}
