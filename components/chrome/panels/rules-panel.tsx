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
 * Two pages, the BOARD's shape: the topics, then one topic's items with
 * their values. Reading is the whole job at this width — changing any of
 * it means the charter's own sheet, which knows about polls, approvals
 * and who's allowed, so a row that can be edited hands off to it rather
 * than growing a second, worse editor in a 19rem column.
 */

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Circle, Hourglass, Lock, Vote } from 'lucide-react'
import {
  closePanel,
  openCharterGroup,
} from '@/components/chrome/canvas-store'
import { groupCharter, type CharterTopic } from '@/lib/charter-groups'
import type { CharterEntry } from '@/lib/data/mock-charter'
import { cn } from '@/lib/utils'

export function RulesPanel({
  charter,
  /** The charter's own sheet is only mounted on the preseason week, so
   *  that's the only place a row can offer to open it. */
  editable,
}: {
  charter: CharterEntry[]
  editable: boolean
}) {
  const [openTopic, setOpenTopic] = useState<string | null>(null)
  const topics = groupCharter(charter)
  const topic = topics.find((t) => t.name === openTopic) ?? null

  if (topic) {
    return <TopicPage topic={topic} editable={editable} onBack={() => setOpenTopic(null)} />
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
            onClick={() => setOpenTopic(t.name)}
            aria-label={`${t.name} — ${t.entries.length} items`}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-foreground/90 uppercase">
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
  editable,
  onBack,
}: {
  topic: CharterTopic
  editable: boolean
  onBack: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground mb-2 flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
      >
        <ChevronLeft className="h-3 w-3" />
        Rules
      </button>
      <h2 className="font-display mb-3 shrink-0 text-2xl leading-none tracking-tight text-foreground/90 uppercase">
        {topic.name}
      </h2>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {topic.entries.map((e) => {
          const row = (
            <>
              <StatusMark entry={e} />
              <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
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
                {valueOf(e)}
              </span>
            </>
          )
          // Only the preseason week has the sheet that can change this.
          // Everywhere else the row is what it says it is — text.
          return editable ? (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                closePanel()
                openCharterGroup(topic.name, e.id)
              }}
              aria-label={`${e.label} — open in the charter`}
              className="flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              {row}
            </button>
          ) : (
            <div
              key={e.id}
              className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2"
            >
              {row}
            </div>
          )
        })}
      </div>
    </div>
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
