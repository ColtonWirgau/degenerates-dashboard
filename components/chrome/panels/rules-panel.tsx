'use client'

/**
 * THE LEAGUE'S BOOK — every topic, every line, and what each was settled
 * at.
 *
 * It had its own rung on the rail for a while, which was one rung too
 * many: the book belongs to a SEASON. Its buy-in, its punishment, its
 * format are that year's, and the panel that answers "which year, and
 * who was in it" is the season panel. So the book lives there now, under
 * the roster, and flipping the year re-reads it along with everything
 * else in that panel.
 *
 * Two exports, because the host does the paging:
 *
 *   RulesBook        the whole thing, open — topics as headings, lines
 *                    under them. Topics were their own page once, which
 *                    made five rows you had to press to find out what
 *                    was in them: a table of contents for a document
 *                    short enough to just print.
 *   CharterItemPage  one line, and whatever it wants from you. Renders
 *                    EntryAction, the same component the preseason
 *                    ballot puts under an open question — so a locked
 *                    rule reads its value back, a live poll is votable
 *                    right here, a proposal can be approved. Renaming
 *                    and removing sit at the foot, away from the thing
 *                    you came to do.
 *
 * DRAFT isn't in the book. It's the preseason page's hero — a band with
 * the date, the room and the format across the top of the card — and a
 * second copy of those in a column is how two surfaces start disagreeing
 * about when the draft is.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Circle,
  Hourglass,
  Lock,
  Pencil,
  Trash2,
  Vote,
  X,
} from 'lucide-react'
import { EntryAction } from '@/components/charter/entry-action'
import { usePollVoting } from '@/components/polls/use-poll-voting'
import {
  hasAnyAnswer,
  viewerVoteFor,
  type PollMember,
} from '@/components/polls/types'
import {
  deleteCharter,
  deleteCharterGroup,
  renameCharterGroup,
  updateCharter,
} from '@/app/actions/charter'
import { groupCharter } from '@/lib/charter-groups'
import type { CharterEntry } from '@/lib/data/mock-charter'
import type { LeaguePoll } from '@/lib/data/mock-polls'
import { cn } from '@/lib/utils'

export function RulesBook({
  leagueId,
  season,
  charter,
  polls,
  currentUserId,
  canManage,
  voting,
  onOpenEntry,
}: {
  leagueId: string
  /** Which season's book — topic rename/remove is scoped to it. */
  season: string
  charter: CharterEntry[]
  /** The charter's votes, so a row can say whether it still wants you. */
  polls: LeaguePoll[]
  currentUserId: string
  canManage: boolean
  /** Owned by the host, because the item page shares it. */
  voting: ReturnType<typeof usePollVoting>
  onOpenEntry: (entryId: string) => void
}) {
  const router = useRouter()
  const pollsById = new Map(polls.map((p) => [p.id, p]))
  // DRAFT is not in here — it's the preseason page's hero. See the note
  // at the top of the file.
  const topics = groupCharter(charter).filter((t) => t.name !== 'Draft')
  const setEntryId = onOpenEntry

  return (
    <div data-testid="rules-book">
      <p className="text-muted-foreground mb-2.5 text-[10px] font-bold tracking-[0.3em] uppercase">
        House Rules
      </p>
      {/* THE WHOLE BOOK, OPEN. Topics used to be five rows you pressed to
          find out what was in them — a table of contents for a document
          short enough to just print. Four topics and fifteen-odd items
          fit in a column with room to spare, so they're all here and the
          headings are headings rather than doors. */}
      <div className="space-y-4">
        {topics.map((t) => (
          <section key={t.name}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <h3 className="text-foreground/70 text-[10px] font-bold tracking-[0.28em] uppercase">
                {t.name}
              </h3>
              {/* Only said when something's outstanding. A settled topic
                  has its answers printed right underneath and doesn't
                  need a tally of them. */}
              {t.open > 0 && (
                <span className="text-neon-pink text-[9px] font-bold tracking-widest uppercase">
                  {t.open} open
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {t.entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  poll={e.pollId ? (pollsById.get(e.pollId) ?? null) : null}
                  voting={voting}
                  currentUserId={currentUserId}
                  onOpen={() => setEntryId(e.id)}
                />
              ))}
            </div>
            {/* A topic the league invented can be renamed or removed —
                the built-ins are the shape of the book. */}
            {canManage && t.entries.every((e) => e.category === 'custom') && (
              <NameControls
                name={t.name}
                onRename={async (to) => {
                  await renameCharterGroup(leagueId, season, t.name, to)
                  router.refresh()
                }}
                onDelete={async () => {
                  await deleteCharterGroup(leagueId, season, t.name)
                  router.refresh()
                }}
                removeLabel="Remove topic"
              />
            )}
          </section>
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

/** One line of the book: what it is, and what it was settled at. */
function EntryRow({
  entry,
  poll,
  voting,
  currentUserId,
  onOpen,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  voting: ReturnType<typeof usePollVoting>
  currentUserId: string
  onOpen: () => void
}) {
  const live = poll && poll.status === 'open'
  const answered = live && hasAnyAnswer(viewerVoteFor(poll, voting.sessionVotes, currentUserId))
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${entry.label} — ${valueOf(entry)}`}
      className="flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
    >
      <StatusMark entry={entry} />
      <span className="text-muted-foreground min-w-0 flex-1 text-[11px] leading-tight">
        {entry.label}
      </span>
      <span
        className={cn(
          'min-w-0 max-w-[52%] shrink-0 text-right text-[11px] leading-tight font-semibold',
          entry.status === 'locked'
            ? 'text-foreground/90'
            : 'text-muted-foreground/60 italic'
        )}
      >
        {live ? (answered ? 'Voted' : 'Needs you') : valueOf(entry)}
      </span>
    </button>
  )
}

/**
 * ONE ITEM — the same panel the ballot shows under a question, with the
 * commish's controls folded in at the foot.
 */
export function CharterItemPage({
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
          canManage={canManage}
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
