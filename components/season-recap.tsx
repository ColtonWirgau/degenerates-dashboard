'use client'

/**
 * THE RECAP — a finished season, all on one page.
 *
 * A season that's over stops being a thing you navigate and becomes a
 * thing you read. So this doesn't open on week 1 with 17 more to click
 * through: it opens on the awards nobody wanted, then the board.
 *
 * It used to lead with four stat cards and a section about you. Both
 * went: the totals were true and dull, and "your season" was a second
 * telling of the row you already occupy on the board — the honours are
 * the part anyone actually reads out loud, so they go first.
 *
 * The dot trace is the chart that used to live in FinalStandings and had
 * fallen out of the app entirely — colored connectors tracing each
 * person's run of weeks, one row per member.
 */

import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronLeft } from 'lucide-react'
import { ConnectedDots, type ConnectedDotsResult } from '@/components/connected-dots'
import { getSeasonRecap, type SeasonRecapPayload } from '@/app/actions/season-recap'
import { openPanel } from '@/components/chrome/canvas-store'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function SeasonRecap({
  leagueId,
  season,
}: {
  leagueId: string
  season: string
}) {
  const [data, setData] = useState<SeasonRecapPayload | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    getSeasonRecap(leagueId, season).then((res) => {
      if (cancelled) return
      if (!res.payload) {
        setState('empty')
        return
      }
      setData(res.payload)
      setState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [leagueId, season])

  if (state === 'loading') return <RecapSkeleton />
  if (state === 'empty' || !data) {
    return (
      <p className="text-muted-foreground py-24 text-center text-sm italic">
        Nobody put a leg in this season. There is nothing to remember.
      </p>
    )
  }

  const year = data.season.split('-')[0]

  return (
    <div>
      {/* THE YEAR, as a fixture band — the same construction the draft
          and every week now use. It was a corner slab and the words THE
          RECAP across an empty strip, which named the view without
          saying anything about the season it was recapping.

          The right half is WHO WON IT. That's the one fact a year gets
          remembered by; the board underneath is the argument, and this
          is the verdict. A tie says so rather than picking one. */}
      <section
        aria-label={`${data.season} recap`}
        className="relative -mx-4 -mt-8 mb-8 lg:-mx-20"
      >
        <h1 className="sr-only">The {year} recap</h1>
        <div className="relative flex flex-col overflow-hidden sm:h-[10.5rem] sm:flex-row sm:items-stretch lg:h-[12.5rem]">
          <button
            type="button"
            onClick={() => openPanel('slate')}
            aria-label={`${data.season} — open the week list`}
            className="group relative z-20 flex w-full flex-col items-start justify-center px-4 py-5 text-left transition-[filter] hover:brightness-110 sm:w-[46%] sm:shrink-0 sm:py-0 sm:pr-12 sm:[clip-path:polygon(0_0,100%_0,calc(100%-46px)_100%,0_100%)] lg:w-[42%] lg:pl-20"
            style={{
              backgroundColor: '#0A0A0A',
              backgroundImage:
                'linear-gradient(115deg, rgba(0,217,255,0.22), rgba(0,217,255,0.06) 62%, rgba(0,217,255,0.02))',
            }}
          >
            <span className="text-muted-foreground/60 group-hover:text-neon-blue mb-1.5 inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.28em] uppercase transition-colors">
              <ChevronLeft className="h-3 w-3" />
              All weeks
            </span>
            <span className="font-display text-foreground text-4xl leading-[0.85] tracking-tight uppercase tabular-nums sm:text-5xl lg:text-6xl">
              {year}
            </span>
          </button>

          <Champions people={data.people} />
        </div>
      </section>

      {data.awards.length > 0 && (
        <Section title="The Honors" accent="pink">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {data.awards.map((a) => (
              <div
                key={a.key}
                className={cn(
                  'flex items-stretch overflow-hidden rounded-xl border',
                  a.tone === 'good'
                    ? 'border-neon-blue/25 bg-neon-blue/[0.04]'
                    : 'border-neon-pink/25 bg-neon-pink/[0.04]'
                )}
              >
                {/* The figure on the slab, the way every other number in
                    this app arrives. */}
                <div
                  aria-hidden
                  className="relative flex w-[6.5rem] shrink-0 items-center justify-center self-stretch px-2"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, calc(100% - 11px) 100%, 0 100%)',
                    background:
                      a.tone === 'good'
                        ? 'linear-gradient(150deg, rgba(0,217,255,0.18), rgba(0,217,255,0.03))'
                        : 'linear-gradient(150deg, rgba(255,105,180,0.18), rgba(255,105,180,0.03))',
                  }}
                >
                  {/* Figures range from "+175" to "6 no-shows", and the
                      long ones ran into the slab's slanted edge at a
                      single size. */}
                  <span
                    className={cn(
                      'font-display -mr-2 text-center leading-none tabular-nums',
                      a.figure.length > 8 ? 'text-[0.95rem]' : 'text-xl',
                      a.tone === 'good' ? 'text-neon-blue' : 'text-destructive'
                    )}
                  >
                    {a.figure}
                  </span>
                </div>

                {/* A title and a name. The written punchline that used to
                    sit here was the same sentence for every league, every
                    season — the figure on the slab does the work. */}
                <div className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3 pl-3">
                  <p className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.2em] uppercase">
                    {a.title}
                  </p>
                  <p className="text-foreground/90 mt-1 text-sm font-bold">{a.name}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="The Board" accent="blue">
        <div className="space-y-1.5">
          {data.people.map((p) => (
            <PersonRow key={p.userId} person={p} isMe={p.userId === data.meId} />
          ))}
        </div>
      </Section>

    </div>
  )
}

/**
 * WHO WON THE YEAR — the recap band's right half.
 *
 * One fact, said at the size it deserves: the name, the record, the
 * face. A tie prints both names rather than picking a winner, because
 * the board it sits over doesn't pick one either.
 */
function Champions({ people }: { people: SeasonRecapPayload['people'] }) {
  const champs = people.filter((p) => p.rank === 1)
  if (champs.length === 0) {
    return <div className="relative z-10 flex min-w-0 flex-1" />
  }
  const [first] = champs
  const shared = champs.length > 1

  return (
    <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-4 py-6 sm:py-0 sm:pl-14 lg:pr-20">
      <span className="text-neon-blue/85 mb-2 text-[10px] font-bold tracking-[0.28em] uppercase">
        {shared ? `Shared · ${first!.wins}–${first!.losses}` : `Champion · ${first!.wins}–${first!.losses}`}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 -space-x-3">
          {champs.slice(0, 3).map((c) => (
            <Avatar
              key={c.userId}
              className="ring-neon-blue/50 h-11 w-11 ring-2 lg:h-14 lg:w-14"
            >
              <AvatarImage src={c.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/80 text-primary-foreground text-xs font-bold">
                {(c.fullName ?? c.email).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className="font-display text-foreground min-w-0 truncate text-3xl leading-[0.9] tracking-tight uppercase sm:text-4xl lg:text-5xl">
          {champs.map((c) => c.name).join(' & ')}
        </span>
      </div>
    </div>
  )
}

function PersonRow({
  person,
  isMe,
}: {
  person: SeasonRecapPayload['people'][number]
  isMe: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
        isMe ? 'border-neon-blue/40 bg-neon-blue/[0.08]' : 'border-white/10 bg-white/[0.02]'
      )}
    >
      {/* A repeated number reads as a bug unless the rows sharing it
          say so — hence the T. */}
      <span
        className={cn(
          'font-display w-7 shrink-0 text-center text-sm leading-none',
          person.rank === 1 || isMe ? 'text-neon-blue' : 'text-muted-foreground'
        )}
      >
        {person.tied && <span className="align-top text-[0.7em]">T</span>}
        {person.rank}
      </span>
      <Avatar className="h-7 w-7 shrink-0 ring-1 ring-white/10">
        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-primary/80 text-primary-foreground text-[9px] font-bold">
          {(person.fullName ?? person.email).slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'w-20 shrink-0 truncate text-xs font-semibold',
          isMe ? 'text-neon-blue' : 'text-foreground/90'
        )}
      >
        {isMe ? 'You' : person.name}
      </span>

      {/* The trace gets the room — it's the interesting part of the row. */}
      <div className="hidden min-w-0 flex-1 sm:block">
        <Trace trace={person.trace} />
      </div>

      <span className="text-foreground/80 shrink-0 text-xs font-bold tabular-nums">
        {person.wins}–{person.losses}
      </span>
      <span className="text-muted-foreground w-9 shrink-0 text-right text-[10px] tabular-nums">
        {person.winRate}%
      </span>
    </div>
  )
}

function Trace({
  trace,
}: {
  trace: SeasonRecapPayload['people'][number]['trace']
}) {
  const results: ConnectedDotsResult[] = trace.map((t) => ({
    weekNumber: t.weekNumber,
    weekId: `w${t.weekNumber}`,
    result: t.result,
  }))
  return <ConnectedDots results={results} />
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: 'blue' | 'pink'
  children: React.ReactNode
}) {
  const [first, ...rest] = title.split(' ')
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3 border-b border-white/[0.07] pb-2.5">
        <h2 className="font-display text-xl leading-none tracking-tight uppercase">
          <span className={accent === 'blue' ? 'text-neon-blue' : 'text-neon-pink'}>
            {first}
          </span>{' '}
          <span className="text-foreground/80">{rest.join(' ')}</span>
        </h2>
      </div>
      {children}
    </section>
  )
}

function RecapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the recap">
      {/* The band's own geometry — full bleed, the same height, the same
          slanted seam — so nothing moves when the year lands. */}
      <section className="relative -mx-4 -mt-8 mb-8 lg:-mx-20">
        <div className="relative flex flex-col overflow-hidden sm:h-[10.5rem] sm:flex-row sm:items-stretch lg:h-[12.5rem]">
          <div
            aria-hidden
            className="flex w-full flex-col items-start justify-center px-4 py-5 sm:w-[46%] sm:shrink-0 sm:py-0 sm:[clip-path:polygon(0_0,100%_0,calc(100%-46px)_100%,0_100%)] lg:w-[42%] lg:pl-20"
            style={{
              backgroundColor: '#0A0A0A',
              backgroundImage:
                'linear-gradient(115deg, rgba(0,217,255,0.14), rgba(0,217,255,0.04) 62%, rgba(0,217,255,0.01))',
            }}
          >
            <Skeleton className="mb-2 h-2.5 w-20" />
            <Skeleton className="h-9 w-32 sm:h-11 lg:h-14" />
          </div>
          <div
            aria-hidden
            className="flex min-w-0 flex-1 flex-col justify-center px-4 py-6 sm:py-0 sm:pl-14 lg:pr-20"
          >
            <Skeleton className="mb-2 h-2.5 w-28" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full lg:size-14" />
              <Skeleton className="h-8 w-48 lg:h-11" />
            </div>
          </div>
        </div>
      </section>
      {/* Straight into the honours, which is what the real thing does. */}
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
