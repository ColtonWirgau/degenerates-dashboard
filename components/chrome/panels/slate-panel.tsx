'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { closePanel, setViewedWeek } from '@/components/chrome/canvas-store'
import {
  useLeagueChrome,
  useViewedWeek,
  type ChromeWeek,
} from '@/components/chrome/league-chrome-context'
import type { ParlayPanelWeek } from '@/components/chrome/panels/parlay-panel'
import { cn } from '@/lib/utils'

/**
 * THE WEEKS — the season in order. This is the app's table of contents,
 * starting with week 0, the preseason, where the league settles its own
 * business before a single ball is thrown. Picking one doesn't navigate:
 * the shell stays put and the stage swaps to that week.
 *
 * Each card says what happened, in the same three-band shape RoarTracker
 * uses for a game: a label strip on top, the week's headline in the
 * middle, and a footer of FACES — who hit, who missed, who still owes a
 * leg. A season you can read by scrolling.
 */
export function SlatePanel({
  laysByWeek,
}: {
  /** Per-week legs + missing members, keyed by week id. */
  laysByWeek: Record<string, ParlayPanelWeek>
}) {
  const chrome = useLeagueChrome()
  const viewed = useViewedWeek()
  if (!chrome) return null

  // In season order, earliest first — week 0 at the top, because the
  // season is a story and you read it forwards.
  const ordered = [...chrome.weeks].sort((a, b) => a.weekNumber - b.weekNumber)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        {chrome.season.split('-')[0]} weeks
      </p>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {ordered.map((w) => (
          <WeekCard
            key={w.id}
            week={w}
            lay={laysByWeek[w.id]}
            memberCount={chrome.memberCount}
            active={viewed?.id === w.id}
            isCurrent={chrome.currentWeekId === w.id}
          />
        ))}
        {ordered.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            No weeks yet — this season hasn&apos;t been loaded.
          </p>
        )}
      </div>
    </div>
  )
}

function WeekCard({
  week,
  lay,
  memberCount,
  active,
  isCurrent,
}: {
  week: ChromeWeek
  lay: ParlayPanelWeek | undefined
  memberCount: number
  active: boolean
  isCurrent: boolean
}) {
  const preseason = week.kind === 'preseason'
  const graded = lay?.legs.filter((l) => l.result !== null) ?? []
  const hit = graded.filter((l) => l.result === 'win').length
  const won = week.parlayState === 'won'
  const lost = week.parlayState === 'lost'

  return (
    <button
      type="button"
      onClick={() => {
        setViewedWeek(week.id)
        closePanel()
      }}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'block w-full overflow-hidden rounded-xl border text-left transition-colors',
        active
          ? 'border-neon-blue/50 bg-neon-blue/[0.07]'
          : won
            ? 'border-neon-blue/25 bg-white/[0.02] hover:bg-white/[0.05]'
            : lost
              ? 'border-destructive/25 bg-white/[0.02] hover:bg-white/[0.05]'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      )}
    >
      {/* Label strip — which week, and whether it's the live one. */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-1.5">
        <span
          className={cn(
            'text-[10px] font-bold tracking-[0.2em] uppercase',
            active ? 'text-neon-blue' : 'text-muted-foreground'
          )}
        >
          {preseason ? 'Preseason' : `Week ${week.weekNumber}`}
        </span>
        {isCurrent && (
          <span className="text-neon-blue/80 text-[9px] font-bold tracking-[0.2em] uppercase">
            · Now
          </span>
        )}
        <span className="text-muted-foreground/70 ml-auto text-[10px] tracking-wider uppercase">
          {headline(week, memberCount)}
        </span>
      </div>

      {/* Faces — the week's cast, in the order it matters: who hit, who
          missed, who's still pending, who never picked. */}
      <div className="flex items-center gap-2 px-3 py-2">
        {preseason ? (
          <span className="text-foreground/70 text-xs">
            {week.pollCount > 0
              ? `${week.pollCount} ${week.pollCount === 1 ? 'vote' : 'votes'} on the charter`
              : 'Charter and league business'}
          </span>
        ) : lay && lay.legs.length > 0 ? (
          <FaceRow lay={lay} />
        ) : (
          // A week nobody has opened and a week nobody has picked in are
          // the same fact to a reader, so they get the same sentence.
          <span className="text-muted-foreground/60 text-xs italic">Nobody in yet</span>
        )}
        {graded.length > 0 && (
          <span
            className={cn(
              'ml-auto shrink-0 text-xs font-bold tabular-nums',
              hit === graded.length ? 'text-neon-blue' : 'text-foreground/80'
            )}
          >
            {hit}/{graded.length}
          </span>
        )}
      </div>
    </button>
  )
}

/** Up to eight faces, ringed by outcome — blue hit, pink missed. */
function FaceRow({ lay }: { lay: ParlayPanelWeek }) {
  const ordered = [
    ...lay.legs.filter((l) => l.result === 'win'),
    ...lay.legs.filter((l) => l.result === 'loss'),
    ...lay.legs.filter((l) => l.result === 'push'),
    ...lay.legs.filter((l) => l.result === null),
  ]
  const faces = ordered.slice(0, 8)
  const extra = ordered.length - faces.length

  return (
    <div className="flex min-w-0 items-center">
      <div className="flex -space-x-1.5">
        {faces.map((l) => (
          <Avatar
            key={l.id}
            className={cn(
              'h-6 w-6 ring-2',
              l.result === 'win'
                ? 'ring-neon-blue/70'
                : l.result === 'loss'
                  ? 'ring-destructive/70'
                  : 'ring-white/15'
            )}
          >
            <AvatarImage src={l.avatarUrl ?? undefined} alt={l.fullName ?? l.email} />
            <AvatarFallback className="bg-primary/70 text-primary-foreground text-[8px] font-bold">
              {initialsOf(l.fullName, l.email)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {extra > 0 && (
        <span className="text-muted-foreground ml-2 text-[10px] tabular-nums">
          +{extra}
        </span>
      )}
      {lay.missing.length > 0 && (
        <span className="text-muted-foreground/60 ml-2 text-[10px] whitespace-nowrap">
          {lay.missing.length} out
        </span>
      )}
    </div>
  )
}

/** What the week is doing, in three words or fewer. */
function headline(week: ChromeWeek, memberCount: number): string {
  if (week.kind === 'preseason') {
    if (week.openPollCount > 0) {
      return `${week.openPollCount} open`
    }
    return week.pollCount > 0 ? 'Settled' : 'Open'
  }
  switch (week.parlayState) {
    case 'open':
      return `${week.submissionCount}/${memberCount} in`
    case 'locked':
      return 'Locked'
    case 'graded':
      return 'Grading'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
  }
}

function initialsOf(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}
