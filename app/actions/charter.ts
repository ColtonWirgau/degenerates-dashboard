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
  revalidatePath(`/leagues/${leagueId}`)
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
  revalidatePath(`/leagues/${leagueId}`)
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
  })
  revalidatePath(`/leagues/${input.leagueId}`)
  void publish(channelName.charter(input.leagueId), event.charterEntryProposed, {
    entryId: entry.id,
    userId: me.id,
    value: null,
  })
  return { success: true, error: null, entry }
}
