'use client'

/**
 * THE RULES — the league's own book, on the canvas.
 *
 * Everything the league has already decided used to be printed down the
 * preseason page: seven topics, thirty-odd rows, all of it a RECORD of
 * settled business sitting under the two things that are actually live
 * (the draft, and the votes). Reference material is exactly what a panel
 * is for, so it moved here and the page kept the work.
 *
 * THREE PAGES, and it never leaves the column: the topics, one topic's
 * items, then one item and whatever it wants from you. It used to hand
 * the third one off — close the panel, raise the charter's sheet over
 * the page — which meant pressing something in a column made a modal
 * appear somewhere else showing the same thing. Paging in place is what
 * every other panel in this shell does (the board pages into a person's
 * season) and it's what this should always have done.
 *
 * The item page renders EntryAction, the same component the ballot puts
 * under an open question — so a locked rule reads back its value, a live
 * poll can be voted right here, a proposal can be approved, and an
 * unsettled line can be pitched at. Renaming and removing sit at the
 * foot of the page, away from the thing you came to do.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Hourglass,
  Lock,
  Pencil,
  Trash2,
  Vote,
  X,
} from 'lucide-react'
import {
  openPanel,
  subscribeCharterGroup,
  type CharterGroupRequest,
} from '@/components/chrome/canvas-store'
import { EntryAction } from '@/components/charter/entry-action'
import { usePollVoting } from '@/components/polls/use-poll-voting'
import { viewerVoteFor, type PollMember } from '@/components/polls/types'
import {
  approveCharter,
  deleteCharter,
  deleteCharterGroup,
  renameCharterGroup,
  updateCharter,
} from '@/app/actions/charter'
import { groupCharter, type CharterTopic } from '@/lib/charter-groups'
import type { CharterEntry } from '@/lib/data/mock-charter'
import type { LeaguePoll } from '@/lib/data/mock-polls'
import { cn } from '@/lib/utils'

export function RulesPanel({
  leagueId,
  season,
  charter,
  polls,
  members,
  currentUserId,
  canManage,
}: {
  leagueId: string
  /** Which season's book — topic rename/remove is scoped to it. */
  season: string
  charter: CharterEntry[]
  /** The charter's votes, so an item can be answered from in here. */
  polls: LeaguePoll[]
  members: PollMember[]
  currentUserId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [topicName, setTopicName] = useState<string | null>(null)
  const [entryId, setEntryId] = useState<string | null>(null)

  const voting = usePollVoting(leagueId, currentUserId)
  const [approvals, setApprovals] = useState<Map<string, boolean>>(() => new Map())

  const membersById = new Map(members.map((m) => [m.id, m]))
  const pollsById = new Map(polls.map((p) => [p.id, p]))
  const topics = groupCharter(charter)

  // ANOTHER SURFACE ASKING FOR AN ITEM — the draft fixture on the page,
  // whose rows are the one place outside this panel that still point at
  // a charter entry. It opens the panel and pages it straight there.
  useEffect(
    () =>
      subscribeCharterGroup((r: CharterGroupRequest) => {
        setTopicName(r.group)
        setEntryId(r.entryId ?? null)
        openPanel('rules')
      }),
    []
  )

  const topic = topics.find((t) => t.name === topicName) ?? null
  const entry = entryId
    ? (charter.find((e) => e.id === entryId) ?? null)
    : null

  if (entry) {
    const poll = entry.pollId ? (pollsById.get(entry.pollId) ?? null) : null
    return (
      <ItemPage
        entry={entry}
        poll={poll}
        // The topic the item is filed under, whether or not you got here
        // through it — a deep link from the draft card lands on the item
        // and Back still has somewhere to go.
        topicName={topic?.name ?? topicName ?? 'Rules'}
        onBack={() => setEntryId(null)}
        leagueId={leagueId}
        membersById={membersById}
        membersCount={members.length}
        currentUserId={currentUserId}
        canManage={canManage}
        voting={voting}
        viewerApproved={approvals.get(entry.id) ?? null}
        onApprove={() => {
          setApprovals((prev) => new Map(prev).set(entry.id, true))
          void approveCharter(leagueId, entry.id, true)
        }}
        onChanged={() => {
          setEntryId(null)
          router.refresh()
        }}
      />
    )
  }

  if (topic) {
    return (
      <TopicPage
        topic={topic}
        pollsById={pollsById}
        voting={voting}
        currentUserId={currentUserId}
        onBack={() => setTopicName(null)}
        onOpenEntry={setEntryId}
        // Only a topic the league invented can be renamed or removed —
        // the seven built-ins are the shape of the book.
        editable={
          canManage && topic.entries.every((e) => e.category === 'custom')
        }
        leagueId={leagueId}
        season={season}
        onGone={() => {
          setTopicName(null)
          router.refresh()
        }}
        onRenamed={(to) => {
          setTopicName(to)
          router.refresh()
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="font-display mb-3 shrink-0 text-2xl leading-none tracking-tight uppercase">
        <span className="text-neon-blue">House</span>{' '}
        <span className="text-foreground/80">Rules</span>
      </h2>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {topics.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setTopicName(t.name)}
            aria-label={`${t.name} — ${t.entries.length} items`}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="text-foreground/90 min-w-0 flex-1 truncate text-xs font-semibold tracking-wide uppercase">
              {t.name}
            </span>
            {/* A topic with everything answered is finished business and
                says nothing; one still owing answers says how many. */}
            {t.open > 0 ? (
              <span className="text-neon-pink shrink-0 text-[10px] font-bold tracking-widest uppercase">
                {t.open} open
              </span>
            ) : (
              <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                {t.settled}
              </span>
            )}
            <ChevronRight className="text-muted-foreground/60 h-3.5 w-3.5 shrink-0" />
          </button>
        ))}
        {topics.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            Nothing written down yet.
          </p>
        )}
      </div>
    </div>
  )
}

/** ONE TOPIC — its items and what they were settled at. */
function TopicPage({
  topic,
  pollsById,
  voting,
  currentUserId,
  onBack,
  onOpenEntry,
  editable,
  leagueId,
  season,
  onGone,
  onRenamed,
}: {
  topic: CharterTopic
  pollsById: Map<string, LeaguePoll>
  voting: ReturnType<typeof usePollVoting>
  currentUserId: string
  onBack: () => void
  onOpenEntry: (id: string) => void
  editable: boolean
  leagueId: string
  season: string
  onGone: () => void
  onRenamed: (to: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BackLink label="Rules" onClick={onBack} />
      <h2 className="font-display text-foreground/90 mb-3 shrink-0 text-2xl leading-none tracking-tight uppercase">
        {topic.name}
      </h2>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {topic.entries.map((e) => {
          const poll = e.pollId ? (pollsById.get(e.pollId) ?? null) : null
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpenEntry(e.id)}
              aria-label={`${e.label} — ${valueOf(e)}`}
              className="flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <StatusMark entry={e} />
              <span className="text-muted-foreground min-w-0 flex-1 text-[11px] leading-tight">
                {e.label}
              </span>
              <span
                className={cn(
                  'min-w-0 max-w-[52%] shrink-0 text-right text-[11px] leading-tight font-semibold',
                  e.status === 'locked'
                    ? 'text-foreground/90'
                    : 'text-muted-foreground/60 italic'
                )}
              >
                {poll && poll.status === 'open'
                  ? voting.sessionVotes.has(poll.id) ||
                    viewerVoteFor(poll, voting.sessionVotes, currentUserId)
                    ? 'Voted'
                    : 'Needs you'
                  : valueOf(e)}
              </span>
            </button>
          )
        })}
        {editable && (
          <NameControls
            name={topic.name}
            onRename={async (to) => {
              await renameCharterGroup(leagueId, season, topic.name, to)
              onRenamed(to)
            }}
            onDelete={async () => {
              await deleteCharterGroup(leagueId, season, topic.name)
              onGone()
            }}
            removeLabel="Remove topic"
          />
        )}
      </div>
    </div>
  )
}

/**
 * ONE ITEM — the same panel the ballot shows under a question, with the
 * commish's controls folded in at the foot.
 */
function ItemPage({
  entry,
  poll,
  topicName,
  onBack,
  leagueId,
  membersById,
  membersCount,
  currentUserId,
  canManage,
  voting,
  viewerApproved,
  onApprove,
  onChanged,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  topicName: string
  onBack: () => void
  leagueId: string
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  canManage: boolean
  voting: ReturnType<typeof usePollVoting>
  viewerApproved: boolean | null
  onApprove: () => void
  onChanged: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BackLink label={topicName} onClick={onBack} />
      <h2 className="font-display text-foreground/90 mb-3 shrink-0 text-xl leading-tight tracking-tight uppercase">
        {entry.label}
      </h2>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-2">
        <EntryAction
          entry={entry}
          poll={poll}
          membersById={membersById}
          membersCount={membersCount}
          currentUserId={currentUserId}
          sessionVoteForPoll={
            entry.pollId ? (voting.sessionVotes.get(entry.pollId) ?? null) : null
          }
          onPollVote={
            entry.pollId ? (vote) => voting.recordVote(entry.pollId!, vote) : null
          }
          viewerApproved={viewerApproved}
          onApprove={onApprove}
          sessionOptionReactions={voting.sessionOptionReactions}
          onOptionReaction={voting.setOptionReaction}
          sessionAddedOptions={voting.sessionAddedOptions}
          onAddOption={voting.addOption}
        />
        {canManage && (
          <NameControls
            name={entry.label}
            onRename={async (to) => {
              await updateCharter({ leagueId, entryId: entry.id, label: to })
              onChanged()
            }}
            onDelete={async () => {
              await deleteCharter(leagueId, entry.id, entry.pollId)
              onChanged()
            }}
            removeLabel="Remove"
          />
        )}
      </div>
    </div>
  )
}

/** Rename or remove — at the foot of a page, so the destructive control
 *  is never beside the thing you came here to do. One control for both
 *  an item and a topic; they differ only in the word on the button. */
function NameControls({
  name,
  onRename,
  onDelete,
  removeLabel,
}: {
  name: string
  onRename: (to: string) => Promise<void>
  onDelete: () => Promise<void>
  removeLabel: string
}) {
  const [renaming, setRenaming] = useState(false)
  const [label, setLabel] = useState(name)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (renaming) {
    return (
      <div className="mt-4 flex items-center gap-1.5 border-t border-white/[0.07] pt-3">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="text-foreground min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs focus:border-white/30 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setRenaming(false)
          }}
        />
        <button
          type="button"
          disabled={busy || label.trim().length === 0}
          onClick={async () => {
            setBusy(true)
            await onRename(label.trim())
            setBusy(false)
            setRenaming(false)
          }}
          className="bg-neon-blue shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-black uppercase disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setRenaming(false)}
          aria-label="Cancel"
          className="text-muted-foreground hover:text-foreground shrink-0 p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-3">
      <button
        type="button"
        onClick={() => {
          setLabel(name)
          setRenaming(true)
        }}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Rename
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirming) {
            setConfirming(true)
            return
          }
          setBusy(true)
          await onDelete()
          setBusy(false)
        }}
        className={cn(
          'ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors',
          confirming
            ? 'text-destructive'
            : 'text-muted-foreground/60 hover:text-destructive'
        )}
      >
        <Trash2 className="h-3 w-3" />
        {confirming ? 'Tap again to remove' : removeLabel}
      </button>
    </div>
  )
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground mb-2 flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
    >
      <ChevronLeft className="h-3 w-3" />
      {label}
    </button>
  )
}

/** What an unsettled row is waiting on, in one glyph. */
function StatusMark({ entry }: { entry: CharterEntry }) {
  if (entry.status === 'locked') {
    return <Lock className="text-neon-blue mt-[1px] h-3 w-3 shrink-0" />
  }
  if (entry.pollId) {
    return <Vote className="text-neon-pink mt-[1px] h-3 w-3 shrink-0" />
  }
  if (entry.status === 'pending') {
    return <Hourglass className="text-muted-foreground mt-[1px] h-3 w-3 shrink-0" />
  }
  return <Circle className="text-muted-foreground/50 mt-[1px] h-3 w-3 shrink-0" />
}

function valueOf(entry: CharterEntry): string {
  if (entry.status === 'locked') return entry.value ?? '—'
  if (entry.pollId) return 'On the ballot'
  if (entry.status === 'pending') return 'Awaiting approval'
  return 'Not settled'
}
