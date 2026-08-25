'use client'

import { Clock, Skull, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { closePanel, setStageView, setViewedWeek } from '@/components/chrome/canvas-store'
import {
  useLeagueChrome,
  useOnRecap,
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
 * A card is a NUMBER and a CAST. The number takes the full height of the
 * left edge, set large in the display face, because a week's name is a
 * number and typesetting it as one costs no vertical space — where a
 * "WEEK 1" label strip cost a whole band on every card. The rest of the
 * card is the faces: who hit, who missed, who never picked. A season you
 * can read by scrolling.
 */
/* Every card in this list stands the same height, and that height is the
 * tallest one any of them naturally wants: a week carrying both a hit row
 * and a miss row. Sizing to content made the list read as ragged — a
 * recap card half the height of a week card looks like a different kind
 * of object rather than a peer of it. */
const CARD_H = 'min-h-[97px]'

export function SlatePanel({
  laysByWeek,
}: {
  /** Per-week legs + missing members, keyed by week id. */
  laysByWeek: Record<string, ParlayPanelWeek>
}) {
  const chrome = useLeagueChrome()
  const viewed = useViewedWeek()
  const onRecap = useOnRecap()
  if (!chrome) return null

  // A season is finished once every week in it has closed. That's the
  // condition for the recap existing at all — an in-progress season has
  // nothing to recap yet, and offering one would be offering a verdict
  // on a game still being played.
  const finished =
    chrome.weeks.length > 0 && chrome.weeks.every((w) => w.closed)

  // In season order, earliest first — week 0 at the top, because the
  // season is a story and you read it forwards.
  const ordered = [...chrome.weeks].sort((a, b) => a.weekNumber - b.weekNumber)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The panel's own masthead, in the app's display face and the
          masthead's duotone: the year is the fact, WEEKS is the noun. */}
      <h2 className="font-display mb-3 shrink-0 text-2xl leading-none tracking-tight uppercase">
        <span className="text-neon-blue">{chrome.season.split('-')[0]}</span>{' '}
        <span className="text-foreground/80">Weeks</span>
      </h2>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {finished && (
          <button
            type="button"
            onClick={() => {
              setStageView('recap')
              closePanel()
            }}
            aria-current={onRecap ? 'true' : undefined}
            className={cn(
              'flex w-full items-stretch overflow-hidden rounded-xl border text-left transition-colors',
              CARD_H,
              onRecap
                ? 'border-white/70 bg-white/[0.06]'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
            )}
          >
            {/* Same slab width as a week's number, so the two slab cards
                share a left edge down the list. */}
            <div
              aria-hidden
              className="relative flex w-[4.25rem] shrink-0 items-center justify-center self-stretch"
              style={{
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 11px) 100%, 0 100%)',
                background:
                  'linear-gradient(150deg, rgba(0,217,255,0.18), rgba(0,217,255,0.03))',
              }}
            >
              <Trophy className="text-neon-blue h-6 w-6" strokeWidth={2.25} />
            </div>
            {/* The preseason's typography exactly — these two are the
                cards that aren't weeks, so they say so the same way. */}
            <span
              className={cn(
                'font-display flex min-w-0 flex-1 items-center px-3 text-[2.1rem] leading-none tracking-tight uppercase',
                onRecap ? 'text-foreground' : 'text-foreground/55'
              )}
            >
              The Recap
            </span>
          </button>
        )}
        {ordered.map((w) => (
          <WeekCard
            key={w.id}
            week={w}
            lay={laysByWeek[w.id]}
            memberCount={chrome.memberCount}
            active={viewed?.id === w.id}
            // Every season has a week you land on, but only the live one
            // has a week that's happening. Looking back at 2025, its last
            // week is where you start — it isn't "now".
            isCurrent={chrome.currentWeekId === w.id && !w.closed}
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
  const won = week.parlayState === 'won'
  const lost = week.parlayState === 'lost'

  const open = () => {
    setViewedWeek(week.id)
    closePanel()
  }

  // SELECTION IS NOT A COLOUR IN THIS APP'S PALETTE. Blue means the week
  // was won and pink means it was lost, everywhere — so painting the
  // selected card blue told you week 1 had cashed when it had in fact
  // died on a single leg. The border carries selection, in plain white,
  // and every coloured thing on the card goes on meaning what it means:
  // the slab, the number, the counts all keep saying how the week ended.
  const shell = cn(
    'group relative block w-full overflow-hidden rounded-xl border text-left transition-colors',
    CARD_H,
    active
      ? 'border-white/70 bg-white/[0.06]'
      : won
        ? 'border-neon-blue/25 bg-white/[0.02] hover:bg-white/[0.05]'
        : lost
          ? 'border-destructive/25 bg-white/[0.02] hover:bg-white/[0.05]'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
  )

  // WEEK 0 IS ITS OWN ANIMAL. It has no slate, no legs and no result, so
  // every field the other cards carry would be empty on it. It gets to be
  // one word instead — the season's front cover.
  if (preseason) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Preseason"
        aria-current={active ? 'true' : undefined}
        className={cn(shell, 'flex items-center')}
      >
        {isCurrent && <NowPip />}
        <span
          className={cn(
            'font-display block px-4 text-[2.1rem] leading-none tracking-tight uppercase',
            active
              ? 'text-foreground'
              : isCurrent
                ? 'text-neon-blue'
                : 'text-foreground/55'
          )}
        >
          Preseason
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      // The card SAYS "12" — which is the right thing to look at and the
      // wrong thing to hear. The name is spelled out for anyone reading
      // it aloud, and it keeps the card findable by week.
      aria-label={`Week ${week.weekNumber}`}
      aria-current={active ? 'true' : undefined}
      className={cn(shell, 'flex')}
    >
      {isCurrent && <NowPip />}

      {/* THE NUMBER, full height on the left. A week's name is a number,
          so it's typeset as one rather than spelled out in a label strip
          that then has to be paid for in vertical space. Its slab is
          slanted on the inside edge — the same diagonal the game cards
          split their two teams on, so the two card families read as
          relatives. */}
      <div className="relative flex w-[4.25rem] shrink-0 items-center justify-center self-stretch">
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 11px) 100%, 0 100%)',
            background: won
              ? 'linear-gradient(150deg, rgba(0,217,255,0.17), rgba(0,217,255,0.03))'
              : lost
                ? 'linear-gradient(150deg, rgba(255,105,180,0.17), rgba(255,105,180,0.03))'
                : 'linear-gradient(150deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))',
          }}
        />
        <span
          className={cn(
            'font-display relative -mr-2 text-[2.4rem] leading-none tabular-nums',
            won
              ? 'text-neon-blue/85'
              : lost
                ? 'text-destructive/85'
                : 'text-foreground/40'
          )}
        >
          {week.weekNumber}
        </span>
      </div>

      {/* The week's cast. Once results land it splits in two — who
          survived, who went down — because that's the shape of the
          question you're asking when you scroll back through a season. */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-2.5 pr-3 pl-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-bold tracking-[0.2em] uppercase',
              won
                ? 'text-neon-blue'
                : lost
                  ? 'text-destructive'
                  : 'text-muted-foreground/70'
            )}
          >
            {headline(week, memberCount)}
          </span>
        </div>

        {!lay || lay.legs.length === 0 ? (
          // A week nobody has opened and a week nobody has picked in are
          // the same fact to a reader, so they get the same sentence —
          // minus the "yet" once the week can no longer be picked in.
          <span className="text-muted-foreground/60 block text-xs italic">
            {week.closed ? 'Nobody in' : 'Nobody in yet'}
          </span>
        ) : graded.length === 0 ? (
          <OutcomeRow tone="pending" people={lay.legs} out={lay.missing.length} />
        ) : (
          <>
            {/* A push is settled but survives the parlay, so it rides with
                the hits — muted, so you can still tell them apart. */}
            <OutcomeRow
              tone="hit"
              people={lay.legs.filter(
                (l) => l.result === 'win' || l.result === 'push'
              )}
            />
            <OutcomeRow
              tone="miss"
              people={lay.legs.filter((l) => l.result === 'loss')}
              out={lay.missing.length}
              pending={lay.legs.filter((l) => l.result === null).length}
            />
          </>
        )}
      </div>
    </button>
  )
}

/** The live week, marked rather than spelled — one lit dot in the corner
 *  says "here" without spending a word on it. */
function NowPip() {
  return (
    <span
      aria-label="Current week"
      className="bg-neon-blue neon-glow-blue absolute top-2 right-2 z-10 size-1.5 rounded-full"
    />
  )
}

type Tone = 'hit' | 'miss' | 'pending'

const TONE_MARK: Record<Tone, typeof Trophy> = {
  hit: Trophy,
  miss: Skull,
  pending: Clock,
}

/**
 * One outcome, one row: a mark, then up to seven faces ringed to match.
 * Blue survived, pink went down — the league's whole colour grammar in
 * two lines. A trophy means a win everywhere in this app; a tick would
 * mean "submitted", which is a different thing entirely. An empty row
 * renders nothing rather than an empty shelf.
 */
function OutcomeRow({
  tone,
  people,
  out = 0,
  pending = 0,
}: {
  tone: Tone
  people: ParlayPanelWeek['legs']
  /** Members who never picked — worth saying once, on the last row. */
  out?: number
  /** Legs still awaiting a result. */
  pending?: number
}) {
  if (people.length === 0 && out === 0 && pending === 0) return null
  const Mark = TONE_MARK[tone]

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Mark
        className={cn(
          'h-3 w-3 shrink-0',
          tone === 'hit'
            ? 'text-neon-blue'
            : tone === 'miss'
              ? 'text-destructive'
              : 'text-muted-foreground/60'
        )}
      />
      <div className="flex -space-x-1.5">
        {people.slice(0, 7).map((l) => (
          <Avatar
            key={l.id}
            className={cn(
              'h-6 w-6 ring-2',
              tone === 'hit'
                ? l.result === 'push'
                  ? 'ring-neon-blue/30'
                  : 'ring-neon-blue/70'
                : tone === 'miss'
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
      {/* No "+N" chip: the total is already sitting at the end of the
          row, and saying "7 shown, 4 more" next to "11" is the same
          fact twice. */}
      <span
        className={cn(
          'ml-auto shrink-0 text-xs font-bold tabular-nums',
          tone === 'hit'
            ? 'text-neon-blue'
            : tone === 'miss'
              ? 'text-destructive'
              : 'text-muted-foreground'
        )}
      >
        {people.length}
      </span>
      {(out > 0 || pending > 0) && (
        <span className="text-muted-foreground/60 shrink-0 text-[10px] whitespace-nowrap">
          {[pending > 0 ? `${pending} pending` : null, out > 0 ? `${out} out` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  )
}

/** What the week is doing, in three words or fewer. Preseason never gets
 *  here — it returns above, as one big word. */
function headline(week: ChromeWeek, memberCount: number): string {
  switch (week.parlayState) {
    case 'open':
      // "0/12 in" and "Nobody in yet" underneath are the same sentence
      // twice. The count only earns its place once somebody is in.
      return week.submissionCount === 0 ? 'Open' : `${week.submissionCount}/${memberCount} in`
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
