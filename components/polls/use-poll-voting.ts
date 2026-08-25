'use client'

/**
 * Voting, as a piece of state you can mount anywhere.
 *
 * Every write here is optimistic-then-real: the session overlay changes
 * on the same frame as the tap so the bar moves under your finger, and
 * the server action goes out behind it. The action revalidates and
 * publishes to Ably, so everyone else's tally catches up on its own.
 *
 * The overlay deliberately outlives the response: it stays until a
 * refresh replaces the poll underneath it, which is what stops the tally
 * flickering back to its old value in the gap.
 *
 * No Ably subscription in here on purpose — a surface usually wants to
 * listen on more channels than just polls (the preseason also watches the
 * charter), and two hooks both subscribing would double every refresh.
 */

import { useState } from 'react'
import {
  addPollOption as addPollOptionAction,
  reactToPollOption as reactToPollOptionAction,
  submitPollVote,
} from '@/app/actions/polls'
import type { PollOption, PollOptionPolicy } from '@/lib/data/mock-polls'
import type { SessionVote } from '@/components/polls/types'

export function usePollVoting(leagueId: string, currentUserId: string) {
  const [sessionVotes, setSessionVotes] = useState<Map<string, SessionVote>>(
    () => new Map()
  )
  const [sessionOptionReactions, setSessionOptionReactions] = useState<
    Map<string, 1 | -1 | null>
  >(() => new Map())
  const [sessionAddedOptions, setSessionAddedOptions] = useState<
    Map<string, PollOption[]>
  >(() => new Map())

  const recordVote = (pollId: string, vote: SessionVote) => {
    setSessionVotes((prev) => new Map(prev).set(pollId, vote))
    // Overlay shape → action payload. An empty vote withdraws entirely,
    // which is a different request from not having voted.
    if (vote.choiceId) {
      void submitPollVote(leagueId, pollId, { choiceId: vote.choiceId })
    } else if (vote.choiceIds && vote.choiceIds.length > 0) {
      void submitPollVote(leagueId, pollId, { choiceIds: vote.choiceIds })
    } else if (vote.rankings && vote.rankings.length > 0) {
      void submitPollVote(leagueId, pollId, { rankings: vote.rankings })
    } else {
      void submitPollVote(leagueId, pollId, { clear: true })
    }
  }

  const setOptionReaction = (
    pollId: string,
    optionId: string,
    value: 1 | -1 | null
  ) => {
    setSessionOptionReactions((prev) =>
      new Map(prev).set(`${pollId}::${optionId}`, value)
    )
    void reactToPollOptionAction(leagueId, pollId, optionId, value)
  }

  const addOption = (
    pollId: string,
    label: string,
    policy: PollOptionPolicy,
    hint?: string
  ) => {
    const text = label.trim()
    if (!text) return
    const fine = hint?.trim() || undefined
    // A stand-in so the option is on screen before the server has one.
    // The id is namespaced to the viewer so it can't collide with a real
    // row that arrives on the next refresh.
    const optimistic: PollOption = {
      id: `viewer::${pollId}::${Date.now()}`,
      label: text,
      hint: fine,
      addedBy: currentUserId,
      addedAt: new Date().toISOString(),
      status: policy === 'open' ? 'approved' : 'pending',
      reactions: [],
    }
    setSessionAddedOptions((prev) => {
      const next = new Map(prev)
      next.set(pollId, [...(next.get(pollId) ?? []), optimistic])
      return next
    })
    void addPollOptionAction(leagueId, pollId, text, fine)
  }

  return {
    sessionVotes,
    recordVote,
    sessionOptionReactions,
    setOptionReaction,
    sessionAddedOptions,
    addOption,
  }
}
