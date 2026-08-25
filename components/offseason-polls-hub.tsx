'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { approveCharter } from '@/app/actions/charter'
import { getAblyClient } from '@/lib/ably/client'
import { channelName } from '@/lib/ably/channels'
import { Check, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getInitials,
  hasAnyAnswer,
  viewerVoteFor,
  type PollMember,
  type SessionVote,
} from '@/components/polls/types'
import { usePollVoting } from '@/components/polls/use-poll-voting'
import { DraftCard } from '@/components/charter/draft-card'
import { EntryAction } from '@/components/charter/entry-action'
import type {
  LeaguePoll,
  PollOption,
  PollOptionPolicy,
} from '@/lib/data/mock-polls'
import type { CharterEntry } from '@/lib/data/mock-charter'
import {
  ENTRY_GROUP_ORDER,
  displayGroupFor,
  groupFor,
  type EntryGroup,
} from '@/lib/charter-groups'
import { openCharterGroup } from '@/components/chrome/canvas-store'
import type { SeasonState } from '@/lib/data/types'

export type { PollMember }

interface OffseasonPollsHubProps {
  /** League id — needed so write handlers can target the right channels
   *  + revalidate the right cache path. */
  leagueId: string
  polls: LeaguePoll[]
  charter: CharterEntry[]
  seasonState: SeasonState
  currentUserId: string
  /** Total league member count — used as denominator for participation. */
  membersCount: number
  /** Roster — drives avatars on chart bars and open-text responses. */
  members: PollMember[]
}

// Ranked-choice tally — plurality-weighted (3 pts for 1st, 2 for 2nd, 1
// for 3rd). Same shape regardless of `maxRanks`; we just slice the
// `RANK_POINTS` table.
// ─── Hub ────────────────────────────────────────────────────────────────────

/**
 * Off-/preseason dual-dock — paired top + bottom dock that swap out the
 * in-season parlay flow for league-business polls. Shares vote state in
 * React (mock-only) so changes made in the bottom dock instantly reflect
 * in the top dock's aggregate. Server-persisted votes land with the
 * Phase C polls schema.
 */
export function OffseasonPollsHub({
  leagueId,
  polls,
  charter,
  seasonState,
  currentUserId,
  membersCount,
  members,
}: OffseasonPollsHubProps) {
  void seasonState
  void membersCount
  const membersById = useMemo(() => {
    const m = new Map<string, PollMember>()
    for (const member of members) m.set(member.id, member)
    return m
  }, [members])
  const router = useRouter()
  // Voting is the same everywhere it happens, so it isn't defined here
  // any more — see components/polls/use-poll-voting.
  const {
    sessionVotes,
    recordVote,
    sessionOptionReactions,
    setOptionReaction,
    sessionAddedOptions,
    addOption,
  } = usePollVoting(leagueId, currentUserId)

  // Lifted approvals state — shared between SeasonSetup's inline UI and
  // the BottomDock action queue so an approval done in one surface
  // removes the action from the other.
  const [approvals, setApprovals] = useState<Map<string, boolean>>(() => new Map())
  const approveEntry = (entryId: string) => {
    setApprovals((prev) => {
      const next = new Map(prev)
      next.set(entryId, true)
      return next
    })
    void approveCharter(leagueId, entryId, true)
  }

  // Real-time refresh — when another member votes / reacts / approves
  // anywhere in this league, Ably pushes the event and we re-fetch the
  // server data. Optimistic local state stays in place between the push
  // and the next render so there's no visual flicker.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE !== 'neon') return
    let client: ReturnType<typeof getAblyClient> | null = null
    try {
      client = getAblyClient()
    } catch {
      return
    }
    const pollsCh = client.channels.get(channelName.polls(leagueId))
    const charterCh = client.channels.get(channelName.charter(leagueId))
    const onAny = () => router.refresh()
    pollsCh.subscribe(onAny)
    charterCh.subscribe(onAny)
    return () => {
      pollsCh.unsubscribe(onAny)
      charterCh.unsubscribe(onAny)
    }
  }, [leagueId, router])

  return (
    <SeasonSetup
      charter={charter}
      polls={polls}
      membersById={membersById}
      membersCount={membersCount}
      currentUserId={currentUserId}
      sessionPollVotes={sessionVotes}
      onPollVote={recordVote}
      sessionOptionReactions={sessionOptionReactions}
      onOptionReaction={setOptionReaction}
      sessionAddedOptions={sessionAddedOptions}
      onAddOption={addOption}
      approvals={approvals}
      onApprove={approveEntry}
    />
  )
}

// ─── Top dock (poll results aggregate) ──────────────────────────────────────

// ─── SectionDock helpers ────────────────────────────────────────────────────

// ─── Season Setup section (Charter) ───────────────────────────────────────
//
// Charter entries grouped by functional topic (Draft, Stakes, etc.).
// Status is conveyed by per-row color + icon rather than by ordering.

// The filing system moved out — the RULES panel prints the same topics
// in the same order, and two copies of that mapping drift the first time
// a key is added to one of them. See lib/charter-groups.

// Bridges a Charter entry to a Suggestion category, so an entry can host
// a "Pitch an idea" affordance that feeds the suggestion pool for that
// topic. Entries with no natural suggestion mapping (logistics) skip it.
function SeasonSetup({
  charter,
  polls,
  membersById,
  membersCount,
  currentUserId,
  sessionPollVotes,
  onPollVote,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
  approvals,
  onApprove,
}: {
  charter: CharterEntry[]
  polls: LeaguePoll[]
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  sessionPollVotes: Map<string, SessionVote>
  onPollVote: (pollId: string, vote: SessionVote) => void
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (pollId: string, optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: Map<string, PollOption[]>
  onAddOption: (pollId: string, label: string, policy: PollOptionPolicy) => void
  approvals: Map<string, boolean>
  onApprove: (entryId: string) => void
}) {
  const pollsById = useMemo(() => {
    const m = new Map<string, LeaguePoll>()
    for (const p of polls) m.set(p.id, p)
    return m
  }, [polls])

  const byGroup = useMemo(() => {
    const m = new Map<EntryGroup, CharterEntry[]>()
    for (const g of ENTRY_GROUP_ORDER) m.set(g, [])
    for (const e of charter) {
      // User-added entries render in their own named groups below.
      if (e.category === 'custom') continue
      const arr = m.get(groupFor(e))
      if (arr) arr.push(e)
    }
    return m
  }, [charter])

  // The draft is its own section now; the groups below skip it.
  const draftEntries = byGroup.get('Draft') ?? []

  // Everything that WROTE to the charter from this page is gone with the
  // sheet that hosted it: adding an item is the pod's ADD panel, and
  // renaming, removing and settling all happen on the RULES panel's item
  // page. What's left here reads.

  // WHAT'S ACTUALLY ON THE BALLOT. Week 0's job is settling the things
  // the league hasn't settled — everything else on this page is a record
  // of decisions already made, which is reference, not work. So the open
  // questions come out of their categories and lead.
  const ballot = useMemo(() => {
    const open: Array<{
      entry: CharterEntry
      poll: LeaguePoll | null
      group: string
    }> = []
    for (const e of charter) {
      if (e.status === 'locked') continue
      const poll = e.pollId ? (pollsById.get(e.pollId) ?? null) : null
      // A question is live if it has an open vote, or if it's been
      // proposed and is waiting on approvals.
      const live = (poll && poll.status === 'open') || e.status === 'pending'
      if (!live) continue
      // The topic is a caption here — which sheet it would have opened
      // stopped mattering when the card stopped being a door.
      open.push({ entry: e, poll, group: displayGroupFor(e) })
    }
    return open
  }, [charter, pollsById])

  return (
    // No heading of its own: this IS the preseason week's content, and
    // the week page already says so overhead. A second "Season Setup"
    // title under "Week 0 · Preseason" would just be the same sentence
    // twice.
    <section id="preseason-business" className="mt-8">
      {/* THE DRAFT — out of HOUSE RULES entirely.
          It was a group among groups, which put the one dated event in
          the league's year on the same footing as the trade-veto policy.
          It's the thing everyone actually needs to know, so it gets a
          heading of its own and sits above the rules. Its old header row
          ("9/9 · DRAFT ·>") is gone: that bar existed to name a group
          inside a list of groups, and a section that isn't in a list
          doesn't need one — the heading names it and the count moves to
          the far end like every other section's does. */}
      {draftEntries.length > 0 && (
        <>
          <SectionHeading
            name="Draft"
            settled={draftEntries.every((e) => e.status === 'locked')}
          />
          <div className="mb-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <DraftCard
              entries={draftEntries.map((e) => ({
                key: e.key,
                label: e.label,
                value: e.value,
                status: e.status,
              }))}
              // Pressing a fact on the fixture opens the book at that
              // line — the RULES panel, paged to it. It used to raise a
              // sheet over the page instead, which is the same content
              // in a second kind of surface for no reason.
              onOpenEntry={(key) => {
                const entry = draftEntries.find((e) => e.key === key)
                openCharterGroup('Draft', entry?.id)
              }}
            />
          </div>
        </>
      )}

      {ballot.length > 0 && (
        <>
          {/* The dock's disc aims here — on a phone the charter below
              runs long, and "take me back to the votes" is the one verb
              the preseason week has. */}
          {/* Pink whatever its state — this is the one asking you for
              something. The count is gone: every card underneath says
              NEEDS YOU or VOTED on its own face. */}
          <div id="preseason-ballot">
            <SectionHeading name="Vote" tone="ask" />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {ballot.map(({ entry, poll, group }) => (
              <BallotCard
                key={entry.id}
                entry={entry}
                poll={poll}
                group={group}
                membersById={membersById}
                membersCount={membersCount}
                myVote={viewerVoteFor(poll, sessionPollVotes, currentUserId)}
              >
                {/* The same state-aware panel the charter's sheet uses —
                    it already knows the difference between a live poll, a
                    proposal waiting on approvals, and a line the commish
                    rules on. One vote UI, two places it can appear. */}
                <EntryAction
                  entry={entry}
                  poll={poll}
                  membersById={membersById}
                  membersCount={membersCount}
                  currentUserId={currentUserId}
                  sessionVoteForPoll={
                    entry.pollId ? sessionPollVotes.get(entry.pollId) ?? null : null
                  }
                  onPollVote={
                    entry.pollId ? (vote) => onPollVote(entry.pollId!, vote) : null
                  }
                  viewerApproved={approvals.get(entry.id) ?? null}
                  onApprove={() => onApprove(entry.id)}
                  sessionOptionReactions={sessionOptionReactions}
                  onOptionReaction={onOptionReaction}
                  sessionAddedOptions={sessionAddedOptions}
                  onAddOption={onAddOption}
                />
              </BallotCard>
            ))}
          </div>
        </>
      )}

      {/* EVERYTHING ALREADY SETTLED used to print here — seven topics and
          thirty-odd rows of it, under the two things that are actually
          live. It's a RECORD of decisions already made, which is
          reference rather than work, so it moved to the RULES panel on
          the rail (and the dock's RULES cell on a phone). What's left on
          this page is what week 0 is FOR: the draft, and the votes.

          The panel does the whole job now, including changing an item:
          it pages topics → items → one item, and the item page is the
          same EntryAction this page puts under a question. There is no
          charter sheet any more. */}
    </section>
  )
}

// Short label for what the viewer picked — shown on voting rows once
// they've voted. Multi/ranked collapse to "first pick +N".
function myPickSummary(poll: LeaguePoll, vote: SessionVote): string | null {
  const labelOf = (id: string) =>
    poll.options.find((o) => o.id === id)?.label ?? null
  if (vote.choiceId) return labelOf(vote.choiceId)
  if (vote.choiceIds && vote.choiceIds.length > 0) {
    const first = labelOf(vote.choiceIds[0]!)
    if (!first) return null
    return vote.choiceIds.length > 1
      ? `${first} +${vote.choiceIds.length - 1}`
      : first
  }
  if (vote.rankings && vote.rankings.length > 0) {
    const top = [...vote.rankings].sort((a, b) => a.rank - b.rank)[0]!
    const label = labelOf(top.choiceId)
    if (!label) return null
    return vote.rankings.length > 1
      ? `${label} +${vote.rankings.length - 1}`
      : label
  }
  return null
}

/**
 * A section's name, and nothing else.
 *
 * These were header BARS inside each card — a slab with "4/4", an icon, a
 * chevron. That was a group label inside a list of groups, and the list
 * is gone: the page is down to DRAFT and VOTE, and those get section
 * headings rather than furniture.
 *
 * The tally went with the bar, but the one bit of it worth keeping
 * survives as tone: blue once everything in the section is settled,
 * quiet while anything still isn't. Same signal, no arithmetic.
 */
function SectionHeading({
  name,
  settled,
  tone,
}: {
  name: string
  settled?: boolean
  /** Overrides `settled` — VOTE is pink whatever state it's in. */
  tone?: 'ask'
}) {
  return (
    <h2
      className={cn(
        'font-display mb-2.5 text-xl leading-none tracking-tight uppercase',
        tone === 'ask'
          ? 'text-neon-pink'
          : settled
            ? 'text-neon-blue'
            : 'text-foreground/60'
      )}
    >
      {name}
    </h2>
  )
}
/**
 * ONE QUESTION, one card — the preseason's actual unit of work.
 *
 * The charter panels below are a filing system: everything grouped by
 * what kind of rule it is, which is the right shape for looking a
 * decision up and the wrong shape for making one. A question you owe an
 * answer to shouldn't have to be found inside DRAFT (7/9). So the open
 * ones come out and get said plainly, with the one thing you want to
 * know about each: whether it still needs you.
 */
function BallotCard({
  entry,
  poll,
  group,
  membersById,
  membersCount,
  myVote,
  children,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  group: string
  membersById: Map<string, PollMember>
  membersCount: number
  myVote: SessionVote | null
  /** The vote itself, always under the question. */
  children: React.ReactNode
}) {
  const voted = hasAnyAnswer(myVote)
  const pick = voted && poll && myVote ? myPickSummary(poll, myVote) : null
  // Who's answered — session votes aren't in poll.responses yet, so the
  // viewer is added on top when they've just voted.
  const voterIds = new Set(poll?.responses.map((r) => r.userId) ?? [])
  const inCount = voterIds.size
  const awaiting = Math.max(0, membersCount - inCount)

  return (
    <div
      className={cn(
        // Full width, always. A vote is a column of options with a bar
        // each, and two of those side by side at half width is a shape
        // nothing votes well in.
        'overflow-hidden rounded-xl border transition-colors xl:col-span-2',
        voted
          ? 'border-white/10 bg-white/[0.02]'
          : 'border-neon-pink/35 bg-neon-pink/[0.06]'
      )}
    >
    <div className="flex w-full items-stretch text-left">
      {/* The same slab the rest of the app puts an identity on — here it
          carries whether this one is waiting on YOU. */}
      <div
        aria-hidden
        className="relative flex w-[3.5rem] shrink-0 items-center justify-center self-stretch"
        style={{
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%)',
          background: voted
            ? 'linear-gradient(150deg, rgba(0,217,255,0.14), rgba(0,217,255,0.03))'
            : 'linear-gradient(150deg, rgba(255,105,180,0.22), rgba(255,105,180,0.04))',
        }}
      >
        {voted ? (
          <Check className="text-neon-blue h-5 w-5" strokeWidth={2.5} />
        ) : (
          <Hourglass className="text-neon-pink h-5 w-5" strokeWidth={2.25} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-2.5 pr-3 pl-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/70 truncate text-[10px] font-bold tracking-[0.2em] uppercase">
            {group}
          </span>
          <span
            className={cn(
              'ml-auto shrink-0 text-[10px] font-bold tracking-[0.2em] uppercase',
              voted ? 'text-muted-foreground/60' : 'text-neon-pink'
            )}
          >
            {voted ? 'Voted' : poll ? 'Needs you' : 'Proposed'}
          </span>
        </div>

        <p className="text-foreground/90 text-sm leading-snug font-semibold">
          {entry.label}
        </p>

        <div className="mt-auto flex items-center gap-2">
          {inCount > 0 && (
            <div className="flex -space-x-1.5">
              {[...voterIds].slice(0, 6).map((id) => {
                const m = membersById.get(id)
                return (
                  <Avatar key={id} className="h-5 w-5 ring-2 ring-black/40">
                    <AvatarImage src={m?.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/70 text-primary-foreground text-[7px] font-bold">
                      {getInitials(m?.fullName ?? null, m?.email ?? '')}
                    </AvatarFallback>
                  </Avatar>
                )
              })}
            </div>
          )}
          <span className="text-muted-foreground/60 text-[10px] tabular-nums">
            {poll
              ? awaiting > 0
                ? `${inCount}/${membersCount} in`
                : 'Everyone in'
              : 'Awaiting the commish'}
          </span>
          {pick && (
            <span className="text-neon-blue ml-auto min-w-0 truncate text-[11px] font-semibold">
              {pick}
            </span>
          )}
        </div>
      </div>
    </div>

      {/* THE VOTE ITSELF — not behind anything. It was in the charter's
          sheet, then behind a fold on the card. Both were a press
          standing between the page's one job and doing it. */}
      <div className="space-y-3 border-t border-white/[0.07] px-3.5 py-3">
        {children}
      </div>
    </div>
  )
}
