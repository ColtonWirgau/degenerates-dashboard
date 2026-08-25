'use client'

/**
 * THE RECAP — a finished season, all on one page.
 *
 * A season that's over stops being a thing you navigate and becomes a
 * thing you read. So this doesn't open on week 1 with 17 more to click
 * through: it opens on the number that decides how the year is
 * remembered, then you, then everyone else, then the awards nobody
 * wanted.
 *
 * The dot trace is the chart that used to live in FinalStandings and had
 * fallen out of the app entirely — colored connectors tracing each
 * person's run of weeks, one row per member.
 */

import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

  const me = data.people.find((p) => p.userId === data.meId) ?? null
  const year = data.season.split('-')[0]

  return (
    <div>
      {/* THE HEADLINE. The one number that decides how a year gets
          talked about, at the size that decision deserves.

          The year slab is the corner door, same as a week's number is —
          the recap is a whole view of the stage, so without it there'd be
          no way back to the weeks from here. */}
      <header className="flex items-stretch gap-4">
        <button
          type="button"
          onClick={() => openPanel('slate')}
          aria-label={`${data.season} — open the week list`}
          className="relative -mt-8 -ml-4 flex w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-tl-[20px] pt-8 pb-5 transition-[filter] hover:brightness-125 lg:-ml-14 lg:w-[8.75rem] lg:pl-6"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
            background:
              'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          }}
        >
          <span
            aria-hidden
            className="font-display text-foreground/75 -mr-2 text-4xl leading-none tabular-nums"
          >
            {year}
          </span>
        </button>
        <div className="min-w-0 flex-1 self-center pt-1">
          <h1 className="font-display text-3xl leading-none tracking-tight uppercase sm:text-4xl">
            <span className="text-neon-blue">The</span>{' '}
            <span className="text-foreground/80">Recap</span>
          </h1>
        </div>
      </header>

      <ScoreLine data={data} />

      {me && <YourSeason me={me} weeks={data.weeks} />}

      <Section title="The Board" accent="blue">
        <div className="space-y-1.5">
          {data.people.map((p, i) => (
            <PersonRow
              key={p.userId}
              rank={i + 1}
              person={p}
              isMe={p.userId === data.meId}
            />
          ))}
        </div>
      </Section>

      {data.awards.length > 0 && (
        <Section title="The Honours" accent="pink">
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
                  <span
                    className={cn(
                      'font-display -mr-2 text-center text-xl leading-none tabular-nums',
                      a.tone === 'good' ? 'text-neon-blue' : 'text-destructive'
                    )}
                  >
                    {a.figure}
                  </span>
                </div>

                <div className="min-w-0 flex-1 py-2.5 pr-3 pl-3">
                  <p className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.2em] uppercase">
                    {a.title}
                  </p>
                  <p className="text-foreground/90 mt-0.5 text-sm font-bold">{a.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-snug">
                    {a.line}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

/**
 * How the league's ticket did, said plainly. A season where the parlay
 * never once cashed is the funniest fact available and it gets said
 * first — dressing it up would be a mercy nobody asked for.
 */
function ScoreLine({ data }: { data: SeasonRecapPayload }) {
  const never = data.parlaysHit === 0
  return (
    <div className="mt-4 mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat
        figure={`${data.parlaysHit}/${data.weeksPlayed}`}
        label="Parlays cashed"
        tone={never ? 'bad' : 'good'}
        note={never ? 'Not one. All season.' : undefined}
      />
      <Stat figure={String(data.totalLegs)} label="Legs entered" tone="plain" />
      <Stat figure={String(data.legWins)} label="Legs hit" tone="good" />
      <Stat figure={String(data.legLosses)} label="Legs missed" tone="bad" />
    </div>
  )
}

function Stat({
  figure,
  label,
  tone,
  note,
}: {
  figure: string
  label: string
  tone: 'good' | 'bad' | 'plain'
  note?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <p
        className={cn(
          'font-display text-3xl leading-none tabular-nums',
          tone === 'good'
            ? 'text-neon-blue'
            : tone === 'bad'
              ? 'text-destructive'
              : 'text-foreground/80'
        )}
      >
        {figure}
      </p>
      <p className="text-muted-foreground mt-1.5 text-[10px] font-bold tracking-[0.2em] uppercase">
        {label}
      </p>
      {note && <p className="text-muted-foreground/70 mt-1 text-[11px] italic">{note}</p>}
    </div>
  )
}

/** YOU, first — a recap you're not in is a spreadsheet. */
function YourSeason({
  me,
  weeks,
}: {
  me: SeasonRecapPayload['people'][number]
  weeks: SeasonRecapPayload['weeks']
}) {
  const killed = weeks.filter((w) => w.losses === 1 && w.killedBy[0] === me.name)
  return (
    <Section title="Your Season" accent="blue">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <p className="font-display text-neon-blue text-4xl leading-none tabular-nums">
            {me.wins}–{me.losses}
            {me.pushes > 0 && (
              <span className="text-muted-foreground text-2xl">–{me.pushes}</span>
            )}
          </p>
          <p className="text-foreground/70 text-sm">
            {me.winRate}% · in for {me.weeksIn} weeks
            {me.streak >= 3 && ` · ${me.streak} straight at your best`}
          </p>
        </div>

        <div className="mt-4">
          <Trace trace={me.trace} />
        </div>

        {killed.length > 0 && (
          <p className="text-destructive/80 mt-3 text-xs">
            You were the only one to miss in{' '}
            {killed.map((w) => `week ${w.weekNumber}`).join(' and ')}. The league
            remembers.
          </p>
        )}
      </div>
    </Section>
  )
}

function PersonRow({
  rank,
  person,
  isMe,
}: {
  rank: number
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
      <span
        className={cn(
          'font-display w-6 shrink-0 text-center text-sm leading-none',
          rank === 1 || isMe ? 'text-neon-blue' : 'text-muted-foreground'
        )}
      >
        {rank}
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
      <header className="flex items-stretch gap-4">
        <div
          aria-hidden
          className="relative -mt-8 -ml-4 flex w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-tl-[20px] pt-8 pb-5 lg:-ml-14 lg:w-[8.75rem] lg:pl-6"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
            background:
              'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          }}
        >
          <Skeleton className="-mr-2 h-9 w-20 rounded-lg" />
        </div>
        <div className="min-w-0 flex-1 self-center pt-1">
          <Skeleton className="h-8 w-44 sm:h-9" />
        </div>
      </header>
      <div className="mt-4 mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[5.25rem] rounded-xl" />
        ))}
      </div>
      <Skeleton className="mb-3 h-6 w-40" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  )
}
