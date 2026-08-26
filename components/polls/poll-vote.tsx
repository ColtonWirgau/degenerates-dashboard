'use client'

/**
 * THE VOTE — every way this app lets you answer a poll, in one place.
 *
 * These used to live inside offseason-polls-hub, which was fine while the
 * preseason was the only surface with polls on it. It isn't: a week can
 * raise its own question now, and a second implementation of "tap an
 * option, see the bar move, see who else picked it" would be two things
 * that agree only by accident. So the mechanics moved out here and both
 * surfaces render the same ones.
 *
 * Nothing in this file knows about the charter, or about weeks. It takes
 * a poll, the viewer, and handlers — the surface above decides what a
 * poll MEANS.
 */

import { useState } from 'react'
import { Check, Hammer, Info, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type {
  LeaguePoll,
  PollOption,
  RankedSelection,
} from '@/lib/data/mock-polls'
import {
  displayNameOf,
  getInitials,
  type PollMember,
  type SessionVote,
} from '@/components/polls/types'
import { decidedBy } from '@/lib/poll-outcome'

// Compact inline poll voter for use inside an EntryDock. Supports single-
// choice polls fully; ranked polls land a "Open in voter" CTA pointing at
// the bottom dock since ranked UI is heavier than this surface should
// carry.
export function InlinePollVote({
  poll,
  currentUserId,
  sessionVote,
  onVote,
  membersById,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
  canManage = false,
}: {
  poll: LeaguePoll
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
  membersById: Map<string, PollMember>
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: PollOption[]
  onAddOption: (label: string, hint?: string) => void
  /** Owners and admins put things on the ballot; everyone else votes. */
  canManage?: boolean
}) {
  // Merge session-added options into the poll's roster so the user
  // sees their just-added option immediately.
  const allOptions = [...poll.options, ...sessionAddedOptions]
  const approved = allOptions.filter((o) => o.status === 'approved')
  const pending = allOptions.filter((o) => o.status === 'pending')

  // For ranked polls we still defer to the bottom dock for the actual
  // ranking UI, but pending lane + add-option still apply inline.
  const isRanked = poll.kind === 'ranked'

  return (
    <div className="space-y-4">
      {/* Approved options — the real vote mechanic */}
      {isRanked ? (
        <RankedChoiceVote
          poll={poll}
          currentUserId={currentUserId}
          sessionVote={sessionVote}
          onVote={onVote}
        />
      ) : poll.kind === 'multi' ? (
        <MultiChoiceVote
          poll={poll}
          options={approved}
          currentUserId={currentUserId}
          sessionVote={sessionVote}
          onVote={onVote}
          membersById={membersById}
        />
      ) : (
        <SingleChoiceVote
          poll={poll}
          options={approved}
          currentUserId={currentUserId}
          sessionVote={sessionVote}
          onVote={onVote}
          membersById={membersById}
          memberCount={membersById.size}
        />
      )}

      {/* Pending lane — only renders for curated polls. Members can
          up/down to signal which pending options the commish should
          promote into the votable set. */}
      {poll.optionPolicy === 'curated' && pending.length > 0 && (
        <PendingOptionsLane
          pollId={poll.id}
          options={pending}
          currentUserId={currentUserId}
          membersById={membersById}
          sessionReactions={sessionOptionReactions}
          onReact={onOptionReaction}
        />
      )}

      {/* Add-option control — the commish's, on a poll whose options
          aren't fixed. */}
      {canManage && poll.optionPolicy !== 'closed' && (
        <AddOptionControl onSubmit={onAddOption} />
      )}
    </div>
  )
}

// Inline ranked voter — tap options in preference order (tap again to
// unrank; ranks above the removed slot shift down). Saves on every
// change like the other inline voters.
export function RankedChoiceVote({
  poll,
  currentUserId,
  sessionVote,
  onVote,
}: {
  poll: LeaguePoll
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
}) {
  const fixtureViewer = poll.responses.find((r) => r.userId === currentUserId)
  const effective = sessionVote
    ? sessionVote.rankings ?? []
    : fixtureViewer?.rankings ?? []
  const maxRanks = poll.maxRanks ?? 3

  const cycleRank = (optionId: string) => {
    const existing = effective.find((r) => r.choiceId === optionId)
    let next: RankedSelection[]
    if (existing) {
      next = effective
        .filter((r) => r.choiceId !== optionId)
        .map((r) => (r.rank > existing.rank ? { ...r, rank: r.rank - 1 } : r))
    } else if (effective.length >= maxRanks) {
      return
    } else {
      next = [...effective, { choiceId: optionId, rank: effective.length + 1 }]
    }
    onVote(next.length > 0 ? { rankings: next } : {})
  }

  return (
    <div className="space-y-2">
      {/* Same words as every other kind of poll. "Rank your top 3" was
          saying what the CONTROL does; the question above already says
          what's being decided, and the chips number themselves as you
          tap. */}
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
        Cast Your Vote
      </p>
      <RankedOptions
        poll={poll}
        maxRanks={maxRanks}
        draftRankings={effective}
        onTap={cycleRank}
      />
      {effective.length > 0 && <ClearVoteButton onClear={() => onVote({})} />}
    </div>
  )
}

export function SingleChoiceVote({
  poll,
  options,
  currentUserId,
  sessionVote,
  onVote,
  membersById,
  memberCount = 0,
}: {
  poll: LeaguePoll
  /** How many people could still vote — what makes "decided" arithmetic
   *  rather than a guess. */
  memberCount?: number
  options: PollOption[]
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
  membersById: Map<string, PollMember>
}) {
  const fixtureViewer = poll.responses.find((r) => r.userId === currentUserId)
  // Session overlay wins outright — a session-cleared vote (empty object)
  // means "no choice" even while the fixture row is still present.
  const effectiveChoice = sessionVote
    ? sessionVote.choiceId ?? null
    : fixtureViewer?.choiceId ?? null

  const counts = new Map<string, number>()
  const votersByOption = new Map<string, Array<{ userId: string }>>()
  for (const o of options) {
    counts.set(o.id, 0)
    votersByOption.set(o.id, [])
  }
  for (const r of poll.responses) {
    if (r.userId === currentUserId) continue
    if (r.choiceId && counts.has(r.choiceId)) {
      counts.set(r.choiceId, (counts.get(r.choiceId) ?? 0) + 1)
      votersByOption.get(r.choiceId)?.push({ userId: r.userId })
    }
  }
  if (effectiveChoice && counts.has(effectiveChoice)) {
    counts.set(effectiveChoice, (counts.get(effectiveChoice) ?? 0) + 1)
    votersByOption.get(effectiveChoice)?.push({ userId: currentUserId })
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  const decided = poll.status === 'open' ? decidedBy(counts, memberCount) : null

  if (options.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        No options yet. Add one below to kick things off.
      </p>
    )
  }

  const winner = decided ? options.find((o) => o.id === decided.winnerId) : null

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
          Cast Your Vote
        </p>
        {/* The arithmetic is over. Said out loud so the stragglers know
            their vote can't change it and the commish knows there's
            nothing left to wait for. */}
        {winner && (
          <p className="text-neon-blue text-[10px] font-bold tracking-[0.18em] uppercase">
            Decided &middot; {winner.label}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        {options.map((o) => {
          const n = counts.get(o.id) ?? 0
          const pct = total === 0 ? 0 : Math.round((n / total) * 100)
          const isMine = effectiveChoice === o.id
          const voters = votersByOption.get(o.id) ?? []
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onVote(isMine ? {} : { choiceId: o.id })}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 ring-1 transition-colors',
                isMine
                  ? 'ring-neon-blue bg-neon-blue/[0.08]'
                  : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                    isMine
                      ? 'bg-neon-blue ring-neon-blue text-black'
                      : 'ring-white/20'
                  )}
                >
                  {isMine && <Check className="h-2 w-2" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'truncate min-w-0 flex-1',
                    isMine ? 'text-neon-blue font-semibold' : 'text-foreground/85'
                  )}
                >
                  {o.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {n} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    isMine ? 'bg-neon-blue' : 'bg-white/15'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {voters.length > 0 && (
                <div className="mt-1.5">
                  <VoterStack
                    voters={voters}
                    membersById={membersById}
                    highlightUserId={currentUserId}
                    maxShown={6}
                    size="xs"
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
      {effectiveChoice && (
        <ClearVoteButton onClear={() => onVote({})} />
      )}
    </div>
  )
}

// Small "withdraw my vote" affordance shared by the choice voters. Tapping
// an already-selected option also clears; this is the explicit path.
export function ClearVoteButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="-my-2 inline-flex items-center gap-1 py-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70 hover:text-neon-pink transition-colors"
    >
      <X className="h-3 w-3" />
      Clear my vote
    </button>
  )
}

// Multi-select voter — approval-style "pick every option that works".
// Saves on every toggle like the single voter; clearing the last pick
// withdraws the vote entirely.
export function MultiChoiceVote({
  poll,
  options,
  currentUserId,
  sessionVote,
  onVote,
  membersById,
}: {
  poll: LeaguePoll
  options: PollOption[]
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
  membersById: Map<string, PollMember>
}) {
  const fixtureViewer = poll.responses.find((r) => r.userId === currentUserId)
  const effectiveIds = sessionVote
    ? sessionVote.choiceIds ?? []
    : fixtureViewer?.choiceIds ?? []

  const counts = new Map<string, number>()
  const votersByOption = new Map<string, Array<{ userId: string }>>()
  for (const o of options) {
    counts.set(o.id, 0)
    votersByOption.set(o.id, [])
  }
  for (const r of poll.responses) {
    if (r.userId === currentUserId) continue
    for (const id of r.choiceIds ?? []) {
      if (!counts.has(id)) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
      votersByOption.get(id)?.push({ userId: r.userId })
    }
  }
  for (const id of effectiveIds) {
    if (!counts.has(id)) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
    votersByOption.get(id)?.push({ userId: currentUserId })
  }
  // Denominator is voters, not selections — "3 of 5 can do Saturday".
  const responders =
    poll.responses.filter((r) => r.userId !== currentUserId).length +
    (effectiveIds.length > 0 ? 1 : 0)

  const toggle = (optionId: string) => {
    const next = effectiveIds.includes(optionId)
      ? effectiveIds.filter((id) => id !== optionId)
      : [...effectiveIds, optionId]
    onVote(next.length > 0 ? { choiceIds: next } : {})
  }

  if (options.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        No options yet. Add one below to kick things off.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
        Pick every one that works
      </p>
      <div className="space-y-1.5">
        {options.map((o) => {
          const n = counts.get(o.id) ?? 0
          const pct = responders === 0 ? 0 : Math.round((n / responders) * 100)
          const isMine = effectiveIds.includes(o.id)
          const voters = votersByOption.get(o.id) ?? []
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 ring-1 transition-colors',
                isMine
                  ? 'ring-neon-blue bg-neon-blue/[0.08]'
                  : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded ring-1 ring-inset',
                    isMine
                      ? 'bg-neon-blue ring-neon-blue text-black'
                      : 'ring-white/20'
                  )}
                >
                  {isMine && <Check className="h-2 w-2" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'truncate min-w-0 flex-1',
                    isMine ? 'text-neon-blue font-semibold' : 'text-foreground/85'
                  )}
                >
                  {o.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {n} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    isMine ? 'bg-neon-blue' : 'bg-white/15'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {voters.length > 0 && (
                <div className="mt-1.5">
                  <VoterStack
                    voters={voters}
                    membersById={membersById}
                    highlightUserId={currentUserId}
                    maxShown={6}
                    size="xs"
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
      {effectiveIds.length > 0 && (
        <ClearVoteButton onClear={() => onVote({})} />
      )}
    </div>
  )
}

// ─── Pending options lane (curated polls only) ─────────────────────────────

export function PendingOptionsLane({
  pollId,
  options,
  currentUserId,
  membersById,
  sessionReactions,
  onReact,
}: {
  pollId: string
  options: PollOption[]
  currentUserId: string
  membersById: Map<string, PollMember>
  sessionReactions: Map<string, 1 | -1 | null>
  onReact: (optionId: string, value: 1 | -1 | null) => void
}) {
  // Sort pending options by net score so what the league likes rises.
  const enriched = options.map((opt) => {
    const sessionKey = `${pollId}::${opt.id}`
    const sessionVote = sessionReactions.get(sessionKey)
    const fixtureViewer = opt.reactions.find((r) => r.userId === currentUserId)
    const myVote: 1 | -1 | null =
      sessionVote === undefined ? fixtureViewer?.value ?? null : sessionVote
    const others = opt.reactions.filter((r) => r.userId !== currentUserId)
    const ups = others.filter((r) => r.value === 1).map((r) => ({ userId: r.userId }))
    const downs = others.filter((r) => r.value === -1).map((r) => ({ userId: r.userId }))
    if (myVote === 1) ups.push({ userId: currentUserId })
    if (myVote === -1) downs.push({ userId: currentUserId })
    return { opt, ups, downs, myVote, score: ups.length - downs.length }
  })
  enriched.sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
          Pending · {enriched.length}
        </p>
        <p className="text-[10px] text-muted-foreground/70 italic">
          Up/down to signal — commish promotes the winners
        </p>
      </div>
      <ul className="space-y-1.5">
        {enriched.map(({ opt, ups, downs, myVote, score }) => {
          const author = membersById.get(opt.addedBy)
          const isMine = opt.addedBy === currentUserId
          return (
            <li
              key={opt.id}
              className="rounded-md border border-neon-pink/15 bg-neon-pink/[0.03] px-3 py-2"
            >
              <div className="flex items-start gap-2.5">
                {/* Score column with up/down */}
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onReact(opt.id, myVote === 1 ? null : 1)}
                    aria-label="Upvote"
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded transition-colors',
                      myVote === 1
                        ? 'bg-neon-blue text-black'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-neon-blue'
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <span
                    className={cn(
                      'font-display text-xs font-bold tabular-nums leading-none my-0.5',
                      score > 0
                        ? 'text-neon-blue'
                        : score < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {score > 0 ? `+${score}` : score}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReact(opt.id, myVote === -1 ? null : -1)}
                    aria-label="Downvote"
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded transition-colors',
                      myVote === -1
                        ? 'bg-destructive text-black'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-destructive'
                    )}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[13px] text-foreground/95 leading-snug break-words">
                    {opt.label}
                  </p>
                  {opt.hint && (
                    <p className="text-[10px] text-muted-foreground/80 italic leading-snug">
                      {opt.hint}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <Avatar className="h-3.5 w-3.5 ring-1 ring-white/10">
                      <AvatarImage
                        src={author?.avatarUrl ?? undefined}
                        alt={author?.fullName ?? author?.email ?? 'Member'}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-[6px] font-bold">
                        {getInitials(author?.fullName ?? null, author?.email ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">
                      {isMine ? 'Pitched by you' : displayNameOf(author, opt.addedBy)}
                    </span>
                    {ups.length > 0 && (
                      <div className="inline-flex items-center gap-1 ml-1.5">
                        <ThumbsUp className="h-2.5 w-2.5 text-neon-blue/70" />
                        <VoterStack
                          voters={ups}
                          membersById={membersById}
                          highlightUserId={currentUserId}
                          maxShown={4}
                          size="xs"
                        />
                      </div>
                    )}
                    {downs.length > 0 && (
                      <div className="inline-flex items-center gap-1 ml-1.5">
                        <ThumbsDown className="h-2.5 w-2.5 text-destructive/70" />
                        <VoterStack
                          voters={downs}
                          membersById={membersById}
                          highlightUserId={currentUserId}
                          maxShown={4}
                          size="xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Add option (commish only) ─────────────────────────────────────────────
export function AddOptionControl({
  onSubmit,
}: {
  onSubmit: (label: string, hint?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [hintDraft, setHintDraft] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 rounded-md border border-neon-pink/30 bg-neon-pink/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-neon-pink transition-colors hover:border-neon-pink/55 hover:bg-neon-pink/[0.12]"
      >
        <Hammer className="h-3 w-3" />
        Add an option
      </button>
    )
  }

  const submit = () => {
    if (draft.trim().length === 0) return
    onSubmit(draft.trim(), hintDraft.trim() || undefined)
    setDraft('')
    setHintDraft('')
    setOpen(false)
  }

  return (
    <div className="space-y-2 rounded-md border border-neon-pink/30 bg-neon-pink/[0.04] p-3">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
        Add an option
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Another thing they could be made to do…"
        rows={2}
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-neon-pink/50 resize-none"
      />
      {/* The fine print — what "What these involve" prints for this
          option. Optional; a label that explains itself can go alone. */}
      <textarea
        value={hintDraft}
        onChange={(e) => setHintDraft(e.target.value)}
        placeholder="The fine print — rules, scope, what it actually takes (optional)"
        rows={2}
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-neon-pink/50 resize-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setDraft('')
            setHintDraft('')
          }}
          className="px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold tracking-widest uppercase text-primary-foreground bg-neon-pink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-pink/90 transition-colors"
        >
          Add option
        </button>
      </div>
    </div>
  )
}

// ─── Voter avatar stack ─────────────────────────────────────────────────────

/**
 * Horizontal -space-x-overlap stack of voter avatars. `rank` is optional
 * — when set (ranked polls), it's appended to the hover tooltip so users
 * can see who put this option at which position.
 */
export function VoterStack({
  voters,
  membersById,
  highlightUserId,
  maxShown = 5,
  size = 'sm',
}: {
  voters: Array<{ userId: string; rank?: number }>
  membersById: Map<string, PollMember>
  /** When set, this user's avatar floats to the front of the stack with
   *  a brighter neon-blue ring so viewers can spot themselves. */
  highlightUserId?: string
  maxShown?: number
  size?: 'xs' | 'sm'
}) {
  if (voters.length === 0) return null
  // Pin the highlight user (the viewer) to the front so they're always
  // visible even when the stack overflows past maxShown.
  const sorted = highlightUserId
    ? [...voters].sort((a, b) => {
        if (a.userId === highlightUserId && b.userId !== highlightUserId) return -1
        if (b.userId === highlightUserId && a.userId !== highlightUserId) return 1
        return 0
      })
    : voters
  const visible = sorted.slice(0, maxShown)
  const extra = sorted.length - visible.length
  const dim = size === 'xs' ? 'h-4 w-4' : 'h-5 w-5'
  const text = size === 'xs' ? 'text-[7px]' : 'text-[8px]'
  return (
    <div className="flex -space-x-1.5 shrink-0">
      {visible.map((v) => {
        const member = membersById.get(v.userId)
        const name = displayNameOf(member, v.userId)
        const initials = getInitials(member?.fullName ?? null, member?.email ?? '')
        const isMine = v.userId === highlightUserId
        return (
          <Avatar
            key={v.userId}
            className={cn(
              dim,
              isMine ? 'ring-2 ring-neon-blue' : 'ring-1 ring-black/60'
            )}
            title={
              (isMine ? 'You' : name) + (v.rank ? ` — #${v.rank}` : '')
            }
          >
            <AvatarImage src={member?.avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className={cn('bg-primary text-primary-foreground font-bold', text)}>
              {initials}
            </AvatarFallback>
          </Avatar>
        )
      })}
      {extra > 0 && (
        <div
          className={cn(
            dim,
            text,
            'rounded-full bg-white/10 ring-1 ring-black/60 inline-flex items-center justify-center font-bold text-muted-foreground tabular-nums'
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

// ─── Per-option voter list (third-level disclosure) ────────────────────────
// ─── Ranked options (tap-to-cycle) ──────────────────────────────────────────

export function RankedOptions({
  poll,
  maxRanks,
  draftRankings,
  onTap,
}: {
  poll: LeaguePoll
  maxRanks: number
  draftRankings: RankedSelection[]
  onTap: (optionId: string) => void
}) {
  const rankByChoice = new Map<string, number>()
  for (const r of draftRankings) rankByChoice.set(r.choiceId, r.rank)
  const atCap = draftRankings.length >= maxRanks

  // The chips carry their hints as title tooltips, which is nothing on a
  // phone — and the punishments are exactly the options whose fine print
  // people want before ranking. One toggle opens all of them at once.
  const withHints = poll.options.filter((o) => o.hint)
  const [hintsOpen, setHintsOpen] = useState(false)

  // Build the "Your ranking: 1. X · 2. Y · 3. Z" summary in rank order.
  const orderedSummary = [...draftRankings]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => poll.options.find((o) => o.id === r.choiceId))
    .filter((o): o is NonNullable<typeof o> => !!o)

  return (
    <div className="space-y-2">
      {/* Nothing until you've picked something. The instruction that
          used to sit here explained a control that explains itself —
          tap a chip and it gets a 1. */}
      <p className="text-[10px] tracking-widest uppercase text-muted-foreground/70 leading-tight empty:hidden">
        {orderedSummary.length === 0 ? null : (
          <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Your ranking ·</span>
            {orderedSummary.map((o, i) => (
              <span key={o.id} className="inline-flex items-center gap-1 text-foreground/85 normal-case tracking-normal">
                <span className="inline-flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-neon-blue/20 text-[8px] font-bold text-neon-blue tabular-nums leading-none">
                  {i + 1}
                </span>
                <span className="truncate max-w-[12rem]">{o.label}</span>
              </span>
            ))}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {poll.options.map((o) => {
          const rank = rankByChoice.get(o.id)
          const isRanked = rank != null
          const disabled = !isRanked && atCap
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onTap(o.id)}
              disabled={disabled}
              title={o.hint}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                isRanked
                  ? 'border-neon-blue/60 bg-neon-blue text-primary-foreground'
                  : 'border-white/10 bg-white/[0.02] text-foreground/80 hover:bg-white/[0.06]',
                disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {isRanked && (
                <span className="inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-neon-blue text-[9px] font-bold text-black tabular-nums leading-none">
                  {rank}
                </span>
              )}
              {o.label}
            </button>
          )
        })}
      </div>
      {withHints.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setHintsOpen((v) => !v)}
            className="-my-2 inline-flex items-center gap-1.5 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <Info className="h-3 w-3" />
            {hintsOpen ? 'Hide the fine print' : 'What these involve'}
          </button>
          {hintsOpen && (
            <ul className="mt-2 space-y-1.5">
              {withHints.map((o) => (
                <li key={o.id} className="text-[11px] leading-snug">
                  <span className="font-semibold text-foreground/85">{o.label}</span>{' '}
                  <span className="italic text-muted-foreground/80">— {o.hint}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}


