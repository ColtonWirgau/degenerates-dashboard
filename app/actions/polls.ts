'use server'

// Server actions for poll mutations. Currently the offseason-polls-hub
// UI keeps votes / reactions / pending options in session state — this
// file is the migration target so writes persist + push real-time events.
//
// Wiring step (per surface):
//   1. Find the local `setSessionVotes(...)` call in offseason-polls-hub.tsx
//   2. Replace with `submitPollVote(pollId, vote)` (this action)
//   3. Drop the optimistic-overlay map — Ably + revalidatePath keep the
//      cache fresh.

import { revalidatePath } from 'next/cache'
import { getDataAdapter, type PollVote } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

export async function submitPollVote(
  leagueId: string,
  pollId: string,
  vote: PollVote
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  await adapter.submitPollResponse(pollId, me.id, vote)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.polls(leagueId), event.pollVoteCast, {
    pollId,
    userId: me.id,
  })
  return { success: true, error: null }
}

export async function addPollOption(
  leagueId: string,
  pollId: string,
  label: string
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const trimmed = label.trim()
  if (!trimmed) return { success: false, error: 'Option label is empty' }
  const adapter = await getDataAdapter()
  try {
    await adapter.addPollOption(pollId, me.id, trimmed)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add option',
    }
  }
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.polls(leagueId), event.pollOptionAdded, {
    pollId,
    userId: me.id,
    label: trimmed,
  })
  return { success: true, error: null }
}

export async function reactToPollOption(
  leagueId: string,
  pollId: string,
  optionId: string,
  value: 1 | -1 | null
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  await adapter.reactToPollOption(pollId, optionId, me.id, value)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.polls(leagueId), event.pollOptionReacted, {
    pollId,
    optionId,
    userId: me.id,
    value,
  })
  return { success: true, error: null }
}

export async function promotePollOption(
  leagueId: string,
  pollId: string,
  optionId: string
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can promote options' }
  }
  await adapter.promotePollOption(pollId, optionId)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.polls(leagueId), event.pollOptionPromoted, {
    pollId,
    optionId,
  })
  return { success: true, error: null }
}

/**
 * Add a poll to a week. Preseason is where the league's own business
 * lives, so that's usually week 0 — but a one-off question can hang off
 * whichever week raised it.
 */
export async function createPollForWeek(input: {
  leagueId: string
  nflWeekId: string
  title: string
  prompt: string
  topic: 'punishment' | 'payout' | 'rules' | 'season' | 'fun' | 'logistics'
  kind: 'single' | 'multi' | 'ranked'
  optionPolicy?: 'closed' | 'open' | 'curated'
  options: string[]
}) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized', poll: null }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(input.leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can add polls', poll: null }
  }

  const title = input.title.trim()
  if (!title) return { success: false, error: 'A poll needs a question', poll: null }
  const options = input.options.map((o) => o.trim()).filter(Boolean)
  // An open-option poll can start empty — people add the answers. A
  // closed one with nothing to pick is just a dead end.
  if (options.length < 2 && (input.optionPolicy ?? 'closed') === 'closed') {
    return { success: false, error: 'Give it at least two options', poll: null }
  }

  const poll = await adapter.createPoll({
    leagueId: input.leagueId,
    nflWeekId: input.nflWeekId,
    kind: input.kind,
    title,
    prompt: input.prompt.trim() || title,
    topic: input.topic,
    optionPolicy: input.optionPolicy ?? 'closed',
    maxRanks: input.kind === 'ranked' ? Math.min(3, options.length) : undefined,
    options: options.map((label) => ({ label })),
    createdBy: me.id,
  })

  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  void publish(channelName.polls(input.leagueId), event.pollStatusChanged, {
    pollId: poll.id,
    status: 'open',
  })
  return { success: true, error: null, poll }
}

export async function deletePoll(leagueId: string, pollId: string) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can delete polls' }
  }
  await adapter.deletePoll(pollId)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.polls(leagueId), event.pollStatusChanged, {
    pollId,
    status: 'deleted',
  })
  return { success: true, error: null }
}

export async function closePoll(leagueId: string, pollId: string) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can close polls' }
  }
  await adapter.closePoll(pollId)
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.polls(leagueId), event.pollStatusChanged, {
    pollId,
    status: 'closed',
  })
  return { success: true, error: null }
}
