'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  addCharterItem,
  approveCharter,
  deleteCharter,
  deleteCharterGroup,
  renameCharterGroup,
  updateCharter,
} from '@/app/actions/charter'
import { getAblyClient } from '@/lib/ably/client'
import { channelName } from '@/lib/ably/channels'
import {
  Check,
  ChevronRight,
  Circle,
  DollarSign,
  Repeat,
  Trophy,
  Hourglass,
  Layers,
  Lock,
  Pencil,
  Plus,
  ScrollText,
  Skull,
  Sparkles,
  Trash2,
  Vote,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  displayNameOf,
  getInitials,
  hasAnyAnswer,
  viewerVoteFor,
  type PollMember,
  type SessionVote,
} from '@/components/polls/types'
import { usePollVoting } from '@/components/polls/use-poll-voting'
import { InlinePollVote, VoterStack } from '@/components/polls/poll-vote'
import { DraftCard } from '@/components/charter/draft-card'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import type {
  LeaguePoll,
  PollOption,
  PollOptionPolicy,
} from '@/lib/data/mock-polls'
import type {
  CharterEntry,
  CharterApprovalRule,
  CharterCategory,
  CharterStatus,
  KeeperRosterRow,
} from '@/lib/data/mock-charter'
import {
  ENTRY_GROUP_ORDER,
  GROUP_CATEGORY,
  displayGroupFor,
  groupFor,
  isBuiltInGroup,
  type EntryGroup,
} from '@/lib/charter-groups'
import { subscribeCharterGroup } from '@/components/chrome/canvas-store'
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
  /** Owners and admins run the charter — they get the add/edit/remove
   *  controls; everyone else reads and votes. */
  canManage: boolean
  /** The week new polls attach to — the preseason week, since this hub
   *  IS the preseason week's content. */
  nflWeekId: string
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
  canManage,
  nflWeekId,
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
      leagueId={leagueId}
      charter={charter}
      polls={polls}
      membersById={membersById}
      membersCount={membersCount}
      currentUserId={currentUserId}
      season={charter[0]?.season ?? ''}
      canManage={canManage}
      nflWeekId={nflWeekId}
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

// Per-group card visuals. `icon` is the semantic glyph rendered large
// behind the slanted dual-color header. `palette` is the [left, right]
// pair that paints the header. Each pair is pulled from the cyberpunk
// vegas tokens so the set reads cohesive but each card stays distinct.
const GROUP_META: Record<
  EntryGroup,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
    palette: [string, string]
  }
> = {
  Draft: { icon: Layers, palette: ['#FF69B4', '#00D9FF'] },
  Stakes: { icon: DollarSign, palette: ['#00D9FF', '#FF69B4'] },
  Trading: { icon: Repeat, palette: ['#00D9FF', '#FF69B4'] },
  Playoffs: { icon: Trophy, palette: ['#00D9FF', '#FF69B4'] },
  Punishment: { icon: Skull, palette: ['#FF69B4', '#00D9FF'] },
  Rules: { icon: ScrollText, palette: ['#00D9FF', '#FF69B4'] },
  Logistics: { icon: Hourglass, palette: ['#FF69B4', '#00D9FF'] },
}
const CHARTER_ICON: Record<CharterCategory, React.ComponentType<{ className?: string }>> = {
  logistics: Hourglass,
  rules: ScrollText,
  punishment: Skull,
  format: Layers,
  custom: Sparkles,
  stakes: DollarSign,
  keepers: Lock,
  trading: Repeat,
  playoffs: Trophy,
}

const APPROVAL_LABEL: Record<CharterApprovalRule, string> = {
  commish: 'Commish call',
  majority: 'Majority',
  supermajority: 'Supermajority',
  unanimous: 'Unanimous',
  poll: 'Poll vote',
}

// Bridges a Charter entry to a Suggestion category, so an entry can host
// a "Pitch an idea" affordance that feeds the suggestion pool for that
// topic. Entries with no natural suggestion mapping (logistics) skip it.
function SeasonSetup({
  leagueId,
  charter,
  polls,
  membersById,
  membersCount,
  currentUserId,
  season,
  sessionPollVotes,
  onPollVote,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
  approvals,
  onApprove,
  canManage,
  nflWeekId,
}: {
  leagueId: string
  charter: CharterEntry[]
  polls: LeaguePoll[]
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  season: string
  sessionPollVotes: Map<string, SessionVote>
  onPollVote: (pollId: string, vote: SessionVote) => void
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (pollId: string, optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: Map<string, PollOption[]>
  onAddOption: (pollId: string, label: string, policy: PollOptionPolicy) => void
  approvals: Map<string, boolean>
  onApprove: (entryId: string) => void
  canManage: boolean
  nflWeekId: string
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

  // User-added topics, straight off the server: charter entries with
  // category 'custom' carrying their topic name in metadata.group.
  //
  // There's no local mirror any more. It existed to hold a topic that had
  // been NAMED but had nothing in it yet — which the old dashed card could
  // make and nothing else could. The ADD panel takes the name and the
  // first item together, so an empty topic can't be created, and the only
  // state left to hold is the server's.
  const router = useRouter()
  const [customError, setCustomError] = useState<string | null>(null)

  const customGroups: CustomGroupState[] = useMemo(() => {
    const m = new Map<string, CharterEntry[]>()
    for (const e of charter) {
      if (e.category !== 'custom') continue
      const g = e.metadata?.group ?? 'Custom'
      const arr = m.get(g) ?? []
      arr.push(e)
      m.set(g, arr)
    }
    return [...m].map(([name, entries]) => ({ name, entries }))
  }, [charter])

  /**
   * ADD ONE ITEM — to any topic, built-in or your own. Give it options
   * and it becomes a vote the league settles together; give it none and
   * it's a line the commish rules on. Same object either way, so it's
   * one control rather than two features that drift apart.
   */
  const addItem = (
    groupName: string,
    label: string,
    rule: CharterApprovalRule,
    options: string[]
  ) => {
    setCustomError(null)
    void addCharterItem({
      leagueId,
      season,
      nflWeekId,
      group: groupName,
      category: isBuiltInGroup(groupName) ? GROUP_CATEGORY[groupName] : 'custom',
      label,
      approvalRule: rule,
      options,
    }).then((res) => {
      if (res.error) setCustomError(res.error)
      else router.refresh()
    })
  }

  const editItem = (entryId: string, label: string) => {
    setCustomError(null)
    void updateCharter({ leagueId, entryId, label }).then((res) => {
      if (res.error) setCustomError(res.error)
      else router.refresh()
    })
  }

  const removeItem = (entryId: string, pollId: string | null) => {
    setCustomError(null)
    void deleteCharter(leagueId, entryId, pollId).then((res) => {
      if (res.error) setCustomError(res.error)
      else router.refresh()
    })
  }

  const renameGroup = (from: string, to: string) => {
    setCustomError(null)
    void renameCharterGroup(leagueId, season, from, to).then((res) => {
      if (res.error) setCustomError(res.error)
      else router.refresh()
    })
  }

  const removeGroup = (name: string) => {
    setCustomError(null)
    void deleteCharterGroup(leagueId, season, name).then((res) => {
      if (res.error) setCustomError(res.error)
      else router.refresh()
    })
  }

  // Which group's sheet is open (built-in or custom). Null = list view
  // only. `entryId` deep-links the sheet straight to that entry's page —
  // tapping "Location" on the main page lands on Location, with Back
  // returning to the group list.
  const [openGroup, setOpenGroup] = useState<
    | { kind: 'builtin'; group: EntryGroup; entryId?: string }
    | { kind: 'custom'; name: string; entryId?: string }
    | null
  >(null)

  /**
   * WHICH BALLOT CARDS ARE OPEN — and by default, the ones that want
   * something from you.
   *
   * They all started closed, which meant the page's whole job ("two
   * questions need answering") was two rows you had to press before it
   * would tell you what they were. Nothing is saved by that: the section
   * is short, and a question you have to open to read is a question you
   * put off. So an unanswered one is open with its options showing, and
   * one you've already answered is folded down to its row — where it
   * still says what you picked.
   *
   * The set is snapshotted ONCE, from what was answered when the page
   * loaded, so casting a vote doesn't slam the card shut under your hand
   * and reflow the grid mid-click. It folds on the next load, by which
   * time it's a record rather than a question.
   */
  const [foldedAtLoad] = useState<Set<string>>(() => {
    const done = new Set<string>()
    for (const e of charter) {
      if (!e.pollId) continue
      const poll = polls.find((p) => p.id === e.pollId) ?? null
      if (hasAnyAnswer(viewerVoteFor(poll, sessionPollVotes, currentUserId))) {
        done.add(e.id)
      }
    }
    return done
  })
  const [ballotToggles, setBallotToggles] = useState<Map<string, boolean>>(
    () => new Map()
  )
  const ballotOpen = (id: string) => ballotToggles.get(id) ?? !foldedAtLoad.has(id)
  const toggleBallot = (id: string) =>
    setBallotToggles((prev) => {
      const next = new Map(prev)
      next.set(id, !ballotOpen(id))
      return next
    })

  // THE RULES PANEL ASKING FOR AN EDITOR. It prints the book but can't
  // change it — the poll, the approvals, the rename and the delete all
  // live in the sheet below — so it names a topic and an item and this
  // opens them. Built-in or custom is decided here, from the name,
  // because the panel files by display name and doesn't care which.
  useEffect(
    () =>
      subscribeCharterGroup(({ group, entryId }) => {
        setOpenGroup(
          isBuiltInGroup(group)
            ? { kind: 'builtin', group, ...(entryId ? { entryId } : {}) }
            : { kind: 'custom', name: group, ...(entryId ? { entryId } : {}) }
        )
      }),
    []
  )

  // Resolve the entries + sheet header info for whatever group is open.
  const sheetData = (() => {
    if (!openGroup) return null
    if (openGroup.kind === 'builtin') {
      const entries = byGroup.get(openGroup.group) ?? []
      return {
        name: openGroup.group as string,
        icon: GROUP_META[openGroup.group].icon,
        entries,
        custom: false,
        onAddItem: (label: string, rule: CharterApprovalRule, options: string[]) =>
          addItem(openGroup.group, label, rule, options),
      }
    }
    const cg = customGroups.find((g) => g.name === openGroup.name)
    if (!cg) return null
    return {
      name: cg.name,
      icon: Sparkles,
      entries: cg.entries,
      custom: true,
      onAddItem: (label: string, rule: CharterApprovalRule, options: string[]) =>
        addItem(cg.name, label, rule, options),
    }
  })()

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
              onOpenEntry={(key) => {
                const entry = draftEntries.find((e) => e.key === key)
                setOpenGroup({ kind: 'builtin', group: 'Draft', entryId: entry?.id })
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
                expanded={ballotOpen(entry.id)}
                onToggle={() => toggleBallot(entry.id)}
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

          The panel hands a row back here when someone wants to change it
          — see the charter-group subscription above, which opens the same
          sheet the rows always opened. */}

      {customError && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {customError}
        </p>
      )}

      {sheetData && (
        <GroupSheet
          open={openGroup !== null}
          onClose={() => setOpenGroup(null)}
          defaultEntryId={openGroup?.entryId ?? null}
          groupName={sheetData.name}
          icon={sheetData.icon}
          entries={sheetData.entries}
          pollsById={pollsById}
          membersById={membersById}
          membersCount={membersCount}
          currentUserId={currentUserId}
          sessionPollVotes={sessionPollVotes}
          onPollVote={onPollVote}
          sessionOptionReactions={sessionOptionReactions}
          onOptionReaction={onOptionReaction}
          sessionAddedOptions={sessionAddedOptions}
          onAddOption={onAddOption}
          approvals={approvals}
          onApprove={onApprove}
          canManage={canManage}
          onAddItem={sheetData.onAddItem}
          onEditEntry={editItem}
          onDeleteEntry={removeItem}
          onRenameGroup={
            sheetData.custom ? (to: string) => renameGroup(sheetData.name, to) : null
          }
          onDeleteGroup={
            sheetData.custom
              ? () => {
                  removeGroup(sheetData.name)
                  setOpenGroup(null)
                }
              : null
          }
        />
      )}
    </section>
  )
}

// Local container for custom user-added Charter groups + their entries —
// just-created empty groups and optimistic adds; the server rows (category
// 'custom', metadata.group) are the durable truth.
interface CustomGroupState {
  name: string
  entries: CharterEntry[]
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

function GroupSheet({
  open,
  onClose,
  defaultEntryId,
  groupName,
  icon: Icon,
  entries,
  pollsById,
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
  canManage,
  onAddItem,
  onEditEntry,
  onDeleteEntry,
  onRenameGroup,
  onDeleteGroup,
}: {
  open: boolean
  onClose: () => void
  defaultEntryId: string | null
  groupName: string
  icon: React.ComponentType<{ className?: string }>
  entries: CharterEntry[]
  pollsById: Map<string, LeaguePoll>
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
  canManage: boolean
  onAddItem: (label: string, rule: CharterApprovalRule, options: string[]) => void
  onEditEntry: (entryId: string, label: string) => void
  onDeleteEntry: (entryId: string, pollId: string | null) => void
  /** Custom topics can be renamed and removed; the built-in ones can't. */
  onRenameGroup: ((to: string) => void) | null
  onDeleteGroup: (() => void) | null
}) {
  const total = entries.length
  const locked = entries.filter((e) => e.status === 'locked').length

  // Persistent sheet header — stays put while pages slide underneath
  // (and doubles as the drag area on mobile). Adapts to the active
  // page: group identity + locked tally on main; entry label + status
  // chip when paged into an entry.
  const chipBase =
    'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase tabular-nums ring-1'
  const renderHeader = (ctx: { currentPage: string }) => {
    const entry =
      ctx.currentPage === 'main'
        ? null
        : entries.find((e) => e.id === ctx.currentPage) ?? null
    const poll = entry?.pollId ? pollsById.get(entry.pollId) ?? null : null
    const isVoting =
      !!entry && entry.status !== 'locked' && !!poll && poll.status === 'open'
    const chip = !entry ? (
      <span className={cn(chipBase, 'bg-white/[0.04] ring-white/10 text-muted-foreground')}>
        {locked}/{total} locked
      </span>
    ) : entry.status === 'locked' ? (
      <span className={cn(chipBase, 'bg-neon-blue/10 ring-neon-blue/30 text-neon-blue')}>
        Locked
      </span>
    ) : entry.status === 'pending' ? (
      <span className={cn(chipBase, 'bg-neon-pink/10 ring-neon-pink/30 text-neon-pink')}>
        Pending
      </span>
    ) : isVoting ? (
      <span className={cn(chipBase, 'bg-neon-pink/10 ring-neon-pink/40 text-neon-pink animate-pulse')}>
        Voting now
      </span>
    ) : (
      <span className={cn(chipBase, 'bg-white/[0.04] ring-white/10 text-muted-foreground')}>
        Open
      </span>
    )
    return (
      <div className="px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
              <Icon className="h-4 w-4 text-foreground/90" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground truncate">
                {entry ? `Season Setup · ${groupName}` : 'Season Setup'}
              </p>
              <p className="text-base font-bold tracking-wide uppercase text-foreground truncate">
                {entry ? entry.label : groupName}
              </p>
            </div>
          </div>
          {chip}
        </div>
      </div>
    )
  }

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      defaultPage={defaultEntryId ?? 'main'}
      sheetMaxHeight="92dvh"
      maxWidth="max-w-2xl"
      panelClassName="glass-intense border-t border-white/15 md:border md:rounded-2xl"
      header={renderHeader}
    >
      <SheetPage name="main">
        <ul className="space-y-1.5 px-5 pb-6 pt-3">
          {entries.length === 0 && !canManage && (
            <li className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-4 py-6 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </li>
          )}
          {entries.map((entry) => {
            const poll = entry.pollId
              ? pollsById.get(entry.pollId) ?? null
              : null
            return (
              <EntryNavRow
                key={entry.id}
                entry={entry}
                poll={poll}
                myVote={viewerVoteFor(poll, sessionPollVotes, currentUserId)}
              />
            )
          })}
          {canManage && (
            <li className="pt-1">
              <AddEntryControl onSubmit={onAddItem} />
            </li>
          )}
          {canManage && onRenameGroup && onDeleteGroup && (
            <li className="pt-2">
              <TopicControls
                name={groupName}
                onRename={onRenameGroup}
                onDelete={onDeleteGroup}
              />
            </li>
          )}
        </ul>
      </SheetPage>

      {entries.map((entry) => (
        // No page `title` — the persistent sheet header already shows
        // the entry label, so the back bar stays a lone "Back".
        <SheetPage key={entry.id} name={entry.id}>
          <div className="px-5 pb-6">
            <EntryAction
              entry={entry}
              poll={entry.pollId ? pollsById.get(entry.pollId) ?? null : null}
              membersById={membersById}
              membersCount={membersCount}
              currentUserId={currentUserId}
              sessionVoteForPoll={
                entry.pollId ? sessionPollVotes.get(entry.pollId) ?? null : null
              }
              onPollVote={
                entry.pollId
                  ? (vote) => onPollVote(entry.pollId!, vote)
                  : null
              }
              viewerApproved={approvals.get(entry.id) ?? null}
              onApprove={() => onApprove(entry.id)}
              sessionOptionReactions={sessionOptionReactions}
              onOptionReaction={onOptionReaction}
              sessionAddedOptions={sessionAddedOptions}
              onAddOption={onAddOption}
            />
            {canManage && (
              <EntryControls
                entry={entry}
                onRename={(label) => onEditEntry(entry.id, label)}
                onDelete={() => {
                  onDeleteEntry(entry.id, entry.pollId)
                  onClose()
                }}
              />
            )}
          </div>
        </SheetPage>
      ))}
    </ResponsiveSheet>
  )
}

/**
 * ADD AN ITEM — the one add control, wherever you are in the charter.
 *
 * The question is always the same ("what are we deciding?"); the only
 * fork is HOW it gets decided. Leave the options empty and the commish
 * rules on it; type two or more and the league votes. That's why this is
 * one form with an optional list rather than an "add entry" button and
 * an "add poll" button that both make the same row.
 */
function AddEntryControl({
  onSubmit,
}: {
  onSubmit: (label: string, rule: CharterApprovalRule, options: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [rule, setRule] = useState<CharterApprovalRule>('majority')
  const [options, setOptions] = useState<string[]>([])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:border-neon-pink/30 hover:text-neon-pink hover:bg-white/[0.03] transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add an item
      </button>
    )
  }
  const filled = options.map((o) => o.trim()).filter(Boolean)
  const canSubmit = label.trim().length > 0 && filled.length !== 1
  const submit = () => {
    if (!canSubmit) return
    onSubmit(label.trim(), rule, filled)
    setLabel('')
    setRule('majority')
    setOptions([])
    setOpen(false)
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/15 bg-white/[0.03] p-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="What are we deciding? (e.g. 'Side bet ledger')"
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/30"
      />

      {/* The options ARE the fork: none means the commish decides, two
          or more means the league votes on it. */}
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={opt}
              autoFocus={i === options.length - 1}
              onChange={(e) =>
                setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
              }
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
              aria-label={`Remove option ${i + 1}`}
              className="text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOptions((prev) => [...prev, ''])}
          className="text-muted-foreground hover:text-neon-blue inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
        >
          <Plus className="h-3 w-3" />
          {options.length === 0 ? 'Put it to a vote' : 'Another option'}
        </button>
        {filled.length === 1 && (
          <p className="text-destructive text-[10px]">A vote needs at least two.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['commish', 'majority', 'supermajority', 'unanimous'] as const).map(
          (r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRule(r)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors',
                rule === r
                  ? 'bg-neon-blue text-black'
                  : 'bg-white/[0.04] text-muted-foreground ring-1 ring-white/10 hover:bg-white/[0.08]'
              )}
            >
              {APPROVAL_LABEL[r]}
            </button>
          )
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setLabel('')
            setOptions([])
          }}
          className="px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold tracking-widest uppercase text-primary-foreground bg-neon-blue disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-blue/90 transition-colors"
        >
          {filled.length >= 2 ? 'Add vote' : 'Add item'}
        </button>
      </div>
    </div>
  )
}

/** Rename or remove one item. Sits at the foot of its own page, so the
 *  destructive control is never next to the thing you came here to do. */
function EntryControls({
  entry,
  onRename,
  onDelete,
}: {
  entry: CharterEntry
  onRename: (label: string) => void
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [label, setLabel] = useState(entry.label)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="mt-6 border-t border-dashed border-white/10 pt-3">
      {renaming ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={label}
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && label.trim()) {
                onRename(label.trim())
                setRenaming(false)
              }
              if (e.key === 'Escape') {
                setLabel(entry.label)
                setRenaming(false)
              }
            }}
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm focus:border-white/30 focus:outline-none"
          />
          <button
            type="button"
            disabled={!label.trim()}
            onClick={() => {
              onRename(label.trim())
              setRenaming(false)
            }}
            className="bg-neon-blue text-primary-foreground shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase disabled:opacity-40"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="text-muted-foreground hover:text-neon-blue inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Rename
          </button>
          <button
            type="button"
            onClick={() => (confirming ? onDelete() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            className="text-muted-foreground hover:text-destructive ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            {confirming
              ? entry.pollId
                ? 'Delete item and its vote?'
                : 'Sure?'
              : 'Delete'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Rename or remove a whole topic — only the ones the league made up. */
function TopicControls({
  name,
  onRename,
  onDelete,
}: {
  name: string
  onRename: (to: string) => void
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [next, setNext] = useState(name)
  const [confirming, setConfirming] = useState(false)

  if (renaming) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={next}
          autoFocus
          onChange={(e) => setNext(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && next.trim()) {
              onRename(next.trim())
              setRenaming(false)
            }
            if (e.key === 'Escape') {
              setNext(name)
              setRenaming(false)
            }
          }}
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm focus:border-white/30 focus:outline-none"
        />
        <button
          type="button"
          disabled={!next.trim()}
          onClick={() => {
            onRename(next.trim())
            setRenaming(false)
          }}
          className="bg-neon-blue text-primary-foreground shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase disabled:opacity-40"
        >
          Save
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 border-t border-dashed border-white/10 pt-2.5">
      <button
        type="button"
        onClick={() => setRenaming(true)}
        className="text-muted-foreground hover:text-neon-blue inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Rename topic
      </button>
      <button
        type="button"
        onClick={() => (confirming ? onDelete() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        className="text-muted-foreground hover:text-destructive ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
      >
        <Trash2 className="h-3 w-3" />
        {confirming ? 'Delete topic and everything in it?' : 'Delete topic'}
      </button>
    </div>
  )
}

// ─── EntryDock — per-row mini-dock with inline action UI ───────────────────

const STATUS_VISUAL: Record<
  CharterStatus,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
    tone: string
    ring: string
    bg: string
  }
> = {
  locked: {
    icon: Check,
    tone: 'text-neon-blue',
    ring: 'ring-neon-blue/40',
    bg: 'bg-neon-blue',
  },
  pending: {
    icon: Hourglass,
    tone: 'text-neon-pink',
    ring: 'ring-neon-pink/40',
    bg: 'bg-neon-pink',
  },
  draft: {
    icon: Circle,
    tone: 'text-muted-foreground/70',
    ring: 'ring-white/15',
    bg: 'bg-white/[0.08]',
  },
}

// Nav row on the group sheet's main page — status dot, category icon,
// label, current value, chevron. Tapping pages over to the entry's own
// SheetPage (no accordion).
function EntryNavRow({
  entry,
  poll,
  myVote,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  myVote?: SessionVote | null
}) {
  const { navigate } = useResponsiveSheet()
  const CategoryIcon = CHARTER_ICON[entry.category]
  const approvalLabel = APPROVAL_LABEL[entry.approvalRule]
  const statusVisual = STATUS_VISUAL[entry.status]
  const StatusIcon = statusVisual.icon
  const isVoting =
    entry.status !== 'locked' && !!poll && poll.status === 'open'
  const voted = isVoting && hasAnyAnswer(myVote ?? null)
  const pick =
    voted && poll && myVote ? myPickSummary(poll, myVote) : null

  let rightColumn: React.ReactNode = null
  if (entry.status === 'locked' && entry.value) {
    rightColumn = (
      <p className="text-sm font-semibold text-neon-blue truncate text-right">
        {entry.value}
      </p>
    )
  } else if (entry.status === 'pending' && entry.pending) {
    rightColumn = (
      <p className="text-sm text-neon-pink/80 italic truncate text-right">
        Proposed: {entry.pending.value}
      </p>
    )
  } else if (isVoting) {
    rightColumn = voted ? (
      <p className="inline-flex max-w-full items-center justify-end gap-1.5 text-right">
        <span className="shrink-0 font-bold tracking-widest uppercase text-[11px] text-neon-pink">
          Voting now
        </span>
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          · You: {pick ?? 'voted'}
        </span>
      </p>
    ) : (
      <p className="text-[11px] font-bold tracking-widest uppercase text-neon-pink text-right truncate animate-pulse">
        Needs your vote
      </p>
    )
  } else {
    rightColumn = (
      <p className="text-[11px] text-muted-foreground italic text-right truncate">
        {entry.source === 'derived-from-poll'
          ? 'Awaiting poll'
          : entry.approvalRule === 'commish'
            ? 'Up to the commish'
            : 'Not yet proposed'}
      </p>
    )
  }

  return (
    <li className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <button
        type="button"
        onClick={() => navigate(entry.id)}
        className="group flex w-full flex-col px-4 py-3 text-left"
      >
        <span className="flex w-full items-center gap-3">
          {/* Status indicator dot — color + icon convey state at a glance.
              Voting rows override it with the viewer's own state. */}
          {isVoting ? (
            voted ? (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-pink ring-1 ring-inset ring-neon-pink/40">
                <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-neon-pink bg-neon-pink/10 animate-pulse" />
            )
          ) : (
            <span
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                statusVisual.bg,
                statusVisual.ring
              )}
            >
              <StatusIcon className="h-2.5 w-2.5 text-black" strokeWidth={3} />
            </span>
          )}

          <CategoryIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />

          <p className="text-sm font-medium text-foreground/95 truncate flex-1 min-w-0">
            {entry.label}
          </p>

          <span className="hidden sm:block shrink-0 min-w-0 max-w-[18rem]">
            {rightColumn}
          </span>

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </span>

        {/* Secondary row — approval rule; on mobile the value moves here */}
        <span className="mt-1 flex w-full items-center gap-3 pl-8 text-[10px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground/70 font-bold tracking-widest uppercase">
            {entry.source === 'derived-from-poll' && (
              <Vote className="h-2.5 w-2.5" />
            )}
            {approvalLabel}
          </span>
          <span className="sm:hidden ml-auto min-w-0 max-w-[60%]">
            {rightColumn}
          </span>
        </span>
      </button>
    </li>
  )
}

// State-aware action panel inside an expanded EntryDock. Routes to
// inline-vote / approve / propose UI depending on what the entry needs.
function EntryAction({
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
  expanded,
  onToggle,
  children,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  group: string
  membersById: Map<string, PollMember>
  membersCount: number
  myVote: SessionVote | null
  expanded: boolean
  onToggle: () => void
  /** The vote itself — dropped in underneath once opened. */
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
        'overflow-hidden rounded-xl border transition-colors',
        // A vote is a column of options with a bar each — two of those
        // side by side at half width is a shape nothing votes well in.
        expanded && 'xl:col-span-2',
        voted
          ? 'border-white/10 bg-white/[0.02]'
          : 'border-neon-pink/35 bg-neon-pink/[0.06]'
      )}
    >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        'group flex w-full items-stretch text-left transition-colors',
        voted ? 'hover:bg-white/[0.03]' : 'hover:bg-neon-pink/[0.06]'
      )}
    >
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
          {/* The header is a FOLD now, not a door — most cards arrive
              open, so the affordance has to say "you can put this away"
              rather than "there's more in here". */}
          <ChevronRight
            aria-hidden
            className={cn(
              'text-muted-foreground/50 h-3.5 w-3.5 shrink-0 transition-transform',
              expanded && 'rotate-90'
            )}
          />
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
    </button>

      {/* THE VOTE ITSELF. It used to be behind the charter's sheet — you
          pressed a card on the ballot and a sheet came up over the page
          you were already reading, showing the same question again.
          There's room now, so the answer happens where the question is. */}
      {expanded && (
        <div className="space-y-3 border-t border-white/[0.07] px-3.5 py-3">
          {children}
        </div>
      )}
    </div>
  )
}
