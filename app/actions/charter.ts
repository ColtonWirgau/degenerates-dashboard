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
import type { CharterApprovalRule, CharterCategory } from '@/lib/data/mock-charter'

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
