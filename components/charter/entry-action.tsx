'use client'

/**
 * ONE CHARTER ITEM, and whatever it currently wants from you.
 *
 * Locked: what it was settled at. An open poll: the vote. A proposal on
 * the table: the approvals and the button. Nothing yet: the pitch box.
 * Four states, one component, so a surface that shows a charter item
 * doesn't get to have an opinion about which of them it handles.
 *
 * It lived in the preseason hub while the hub's own sheet was the only
 * thing that showed an item. It isn't: the ballot renders it inline and
 * the RULES panel pages into it. A second copy would drift the first
 * time a fifth state existed.
 */

import { Check } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  displayNameOf,
  getInitials,
  type PollMember,
  type SessionVote,
} from '@/components/polls/types'
import { InlinePollVote, VoterStack } from '@/components/polls/poll-vote'
import type {
  LeaguePoll,
  PollOption,
  PollOptionPolicy,
} from '@/lib/data/mock-polls'
import type {
  CharterApprovalRule,
  CharterEntry,
  KeeperRosterRow,
} from '@/lib/data/mock-charter'

/** How an item gets settled, said in words. */
export const APPROVAL_LABEL: Record<CharterApprovalRule, string> = {
  commish: 'Commish call',
  majority: 'Majority',
  supermajority: 'Supermajority',
  unanimous: 'Unanimous',
  poll: 'Poll vote',
}

// State-aware action panel inside an expanded EntryDock. Routes to
// inline-vote / approve / propose UI depending on what the entry needs.
export function EntryAction({
  entry,
  poll,
  membersById,
  membersCount,
  currentUserId,
  sessionVoteForPoll,
  onPollVote,
  viewerApproved,
  onApprove,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  sessionVoteForPoll: SessionVote | null
  onPollVote: ((vote: SessionVote) => void) | null
  viewerApproved: boolean | null
  onApprove: () => void
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (pollId: string, optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: Map<string, PollOption[]>
  onAddOption: (pollId: string, label: string, policy: PollOptionPolicy) => void
}) {
  const approvalLabel = APPROVAL_LABEL[entry.approvalRule]

  // Long-form explanation shared across all statuses — sits at the top
  // of the expanded panel so the viewer understands what the entry
  // governs before the action UI loads.
  const descriptionBlock = entry.description ? (
    <p className="text-[12px] leading-snug text-muted-foreground/90 border-l-2 border-white/10 pl-3">
      {entry.description}
    </p>
  ) : null

  // ─── Locked ────────────────────────────────────────────────────────────
  if (entry.status === 'locked') {
    return (
      <div className="space-y-3">
        {descriptionBlock}
        <div className="space-y-2">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-blue">
            Ratified
          </p>
          <p className="text-base font-semibold text-neon-blue break-words">
            {entry.value}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {approvalLabel}
            {entry.lockedAt &&
              ` · locked ${new Date(entry.lockedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}`}
          </p>
        </div>
        {/* Special table render for the eligible-keepers entry */}
        {entry.key === 'eligible-keepers' && entry.metadata?.keeperRoster && (
          <EligibleKeepersTable
            roster={entry.metadata.keeperRoster}
            membersById={membersById}
            currentUserId={currentUserId}
          />
        )}
      </div>
    )
  }

  // ─── Pending (manual proposal awaiting approvals) ─────────────────────
  if (entry.status === 'pending' && entry.pending) {
    const approvedFromFixture = entry.pending.approvals.filter(
      (a) => a.approved && a.userId !== currentUserId
    ).length
    const viewerFromFixture = entry.pending.approvals.some(
      (a) => a.userId === currentUserId && a.approved
    )
    const viewerEffective =
      viewerApproved === null ? viewerFromFixture : viewerApproved
    const current = approvedFromFixture + (viewerEffective ? 1 : 0)
    const required =
      entry.approvalRule === 'unanimous'
        ? membersCount
        : entry.approvalRule === 'supermajority'
          ? Math.ceil(membersCount * (entry.threshold ?? 0.75))
          : entry.approvalRule === 'majority'
            ? Math.floor(membersCount / 2) + 1
            : membersCount
    const proposer = membersById.get(entry.pending.proposedBy)
    const approverVoters = entry.pending.approvals
      .filter((a) => a.approved && a.userId !== currentUserId)
      .map((a) => ({ userId: a.userId }))
    if (viewerEffective) approverVoters.push({ userId: currentUserId })

    return (
      <div className="space-y-3">
        {descriptionBlock}
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
            Proposal
          </p>
          <p className="text-sm text-foreground/95 italic">
            “{entry.pending.value}”
          </p>
          <p className="text-[11px] text-muted-foreground">
            Pitched by{' '}
            {entry.pending.proposedBy === currentUserId
              ? 'you'
              : displayNameOf(proposer, entry.pending.proposedBy)}
            {' · '}
            {approvalLabel} threshold
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-neon-pink"
                style={{
                  width: `${Math.min(100, Math.round((current / required) * 100))}%`,
                }}
              />
            </div>
            <span className="text-neon-pink font-bold tabular-nums">
              {current}/{required}
            </span>
          </div>
          {approverVoters.length > 0 && (
            <VoterStack
              voters={approverVoters}
              membersById={membersById}
              highlightUserId={currentUserId}
              maxShown={8}
              size="xs"
            />
          )}
        </div>

        {!viewerEffective ? (
          <button
            type="button"
            onClick={onApprove}
            className="w-full rounded-md bg-neon-pink px-3 py-2 text-xs font-bold tracking-widest uppercase text-black hover:bg-neon-pink/80 transition-colors"
          >
            Approve this proposal
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-neon-pink">
            <Check className="h-3 w-3" />
            You approved
          </div>
        )}
      </div>
    )
  }

  // ─── Draft + an open poll: vote ────────────────────────────────────────
  //
  // This used to also require `source === 'derived-from-poll'`, which is
  // where the row CAME FROM — and a row's provenance has nothing to do
  // with whether it can be voted on. An entry someone added by hand and
  // gave options to comes back `source: 'manual'` with a perfectly good
  // open poll attached, and the extra clause meant its vote rendered
  // nowhere at all: not in the charter's sheet, not on the ballot. The
  // League Median question sat like that from the day it was written.
  //
  // Same shape of bug as an entry whose approval_rule is 'poll' with its
  // poll already closed: a question nothing on earth can answer. The
  // condition is the poll, and only the poll.
  if (entry.status === 'draft' && poll && poll.status === 'open') {
    return (
      <div className="space-y-3">
        {descriptionBlock}
        <InlinePollVote
          poll={poll}
          currentUserId={currentUserId}
          sessionVote={sessionVoteForPoll}
          onVote={onPollVote ?? (() => {})}
          membersById={membersById}
          sessionOptionReactions={sessionOptionReactions}
          onOptionReaction={(optionId, value) =>
            onOptionReaction(poll.id, optionId, value)
          }
          sessionAddedOptions={sessionAddedOptions.get(poll.id) ?? []}
          onAddOption={(label) => onAddOption(poll.id, label, poll.optionPolicy)}
        />
      </div>
    )
  }

  // ─── Draft + commish: hint, no inline action for non-commish viewers ──
  if (entry.status === 'draft' && entry.approvalRule === 'commish') {
    return (
      <div className="space-y-3">
        {descriptionBlock}
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
            Commish&apos;s Call
          </p>
          <p className="text-sm text-foreground/85">
            The commissioner picks the value. No vote required.
          </p>
        </div>
      </div>
    )
  }

  // ─── Draft + manual (no proposal yet) ─────────────────────────────────
  return (
    <div className="space-y-3">
      {descriptionBlock}
      <div className="space-y-1">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
          Open for proposals
        </p>
        <p className="text-sm text-foreground/85">
          Be the first to pitch a value. Approval rule: {approvalLabel.toLowerCase()}.
        </p>
      </div>
    </div>
  )
}

// ─── Eligible keepers table (special-render for the keeper roster entry) ──

function EligibleKeepersTable({
  roster,
  membersById,
  currentUserId,
}: {
  roster: KeeperRosterRow[]
  membersById: Map<string, PollMember>
  currentUserId: string
}) {
  if (roster.length === 0) return null
  return (
    <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-muted-foreground/70 border-b border-white/5 bg-white/[0.02]">
        <span>Team · Player</span>
        <span>Pos</span>
        <span className="text-right">Cost</span>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {roster.map((row) => {
          const member = membersById.get(row.userId)
          const isMine = row.userId === currentUserId
          return (
            <li
              key={`${row.userId}-${row.player}`}
              className={cn(
                'grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2',
                isMine && 'bg-neon-blue/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-5 w-5 ring-1 ring-white/10 shrink-0">
                  <AvatarImage
                    src={member?.avatarUrl ?? undefined}
                    alt={member?.fullName ?? member?.email ?? 'Member'}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
                    {getInitials(member?.fullName ?? null, member?.email ?? '')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    {isMine ? 'You' : displayNameOf(member, row.userId)}
                    {isMine && (
                      <span className="inline-flex items-center rounded-full bg-neon-blue/15 ring-1 ring-neon-blue/30 px-1 text-[8px] font-bold tracking-widest uppercase text-neon-blue leading-none">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-semibold text-foreground/95 truncate">
                    {row.player}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground tabular-nums">
                {row.position}
              </span>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-neon-blue">
                  R{row.round}
                </p>
                <p className="text-[9px] tracking-widest uppercase text-muted-foreground/70">
                  {row.yearOfKeep === 2 ? 'ADP · Yr 2' : 'Yr 1'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

