'use client'

import { useState } from 'react'
import { ArrowLeft, Minus, Skull, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { ChromeWeek } from '@/components/chrome/league-chrome-context'
import type { ParlayPanelWeek } from '@/components/chrome/panels/parlay-panel'
import { cn } from '@/lib/utils'

export interface BoardPanelEntry {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  wins: number
  losses: number
  pushes: number
  winRate: number
}

const initials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

/**
 * THE BOARD — the season leaderboard, and one page deeper, any one
 * person's season week by week.
 *
 * The week-by-week used to be a link out to a wide sheet, on the theory
 * that a twelve-by-eighteen grid of dots needs width. It doesn't need to
 * BE a grid: one person at a time is a list, and a list fits a 19rem
 * column comfortably — so the drill-in pages in right here instead of
 * sending you to another surface to read one row of it.
 *
 * No fetch for the second page: the shell already holds every week's
 * legs for the lay, and a person's season is that same data read down a
 * column instead of across a row.
 */
export function BoardPanel({
  entries,
  currentUserId,
  weeks,
  laysByWeek,
}: {
  entries: BoardPanelEntry[]
  currentUserId: string
  /** The season's weeks, in order. */
  weeks: ChromeWeek[]
  /** Every week's legs, keyed by week id. */
  laysByWeek: Record<string, ParlayPanelWeek>
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const person = entries.find((e) => e.userId === openId) ?? null

  if (person) {
    return (
      <PersonSeason
        person={person}
        rank={entries.findIndex((e) => e.userId === person.userId) + 1}
        isMe={person.userId === currentUserId}
        weeks={weeks}
        laysByWeek={laysByWeek}
        onBack={() => setOpenId(null)}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="font-display mb-3 shrink-0 text-2xl leading-none tracking-tight uppercase">
        <span className="text-neon-blue">The</span>{' '}
        <span className="text-foreground/80">Board</span>
      </h2>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {entries.map((e, i) => {
          const isMe = e.userId === currentUserId
          return (
            <button
              key={e.userId}
              type="button"
              onClick={() => setOpenId(e.userId)}
              aria-label={`${e.fullName ?? e.email} — week by week`}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                isMe
                  ? 'border-neon-blue/40 bg-neon-blue/10 hover:bg-neon-blue/[0.16]'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
              )}
            >
              <span
                className={cn(
                  'font-display w-7 shrink-0 text-center text-sm leading-none',
                  i === 0 || isMe ? 'text-neon-blue' : 'text-muted-foreground'
                )}
              >
                {i + 1}
              </span>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={e.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">
                  {initials(e.fullName, e.email)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-xs font-semibold',
                  isMe ? 'text-neon-blue' : 'text-foreground/90'
                )}
              >
                {isMe ? 'You' : (e.fullName ?? e.email.split('@')[0])}
              </span>
              <span className="text-foreground/80 shrink-0 text-xs font-bold tabular-nums">
                {e.wins}–{e.losses}
                {e.pushes > 0 && <span className="text-muted-foreground">–{e.pushes}</span>}
              </span>
              <span className="text-muted-foreground w-9 shrink-0 text-right text-[10px] tabular-nums">
                {e.winRate}%
              </span>
            </button>
          )
        })}
        {entries.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            No results yet.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * ONE PERSON'S SEASON — every week they played, in the app's week
 * grammar: the number on its slab, what they took, how it went.
 */
function PersonSeason({
  person,
  rank,
  isMe,
  weeks,
  laysByWeek,
  onBack,
}: {
  person: BoardPanelEntry
  rank: number
  isMe: boolean
  weeks: ChromeWeek[]
  laysByWeek: Record<string, ParlayPanelWeek>
  onBack: () => void
}) {
  // Their season read down the column: every week that took legs, with
  // theirs if they put one in.
  const rows = weeks
    .filter((w) => w.kind !== 'preseason')
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => ({
      week: w,
      leg: laysByWeek[w.id]?.legs.find((l) => l.userId === person.userId) ?? null,
      opened: laysByWeek[w.id] != null,
    }))
    .filter((r) => r.opened)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-neon-blue mb-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          The Board
        </button>

        <div className="flex items-center gap-2.5">
          <Avatar className="h-10 w-10 shrink-0 ring-1 ring-white/10">
            <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
              {initials(person.fullName, person.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-bold',
                isMe ? 'text-neon-blue' : 'text-foreground/90'
              )}
            >
              {person.fullName ?? person.email.split('@')[0]}
            </p>
            <p className="text-muted-foreground text-[11px] tabular-nums">
              #{rank} · {person.wins}–{person.losses}
              {person.pushes > 0 && `–${person.pushes}`} · {person.winRate}%
            </p>
          </div>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {rows.map(({ week, leg }) => {
          const won = leg?.result === 'win'
          const lost = leg?.result === 'loss'
          return (
            <div
              key={week.id}
              className={cn(
                'flex items-stretch overflow-hidden rounded-lg border',
                won
                  ? 'border-neon-blue/25 bg-white/[0.02]'
                  : lost
                    ? 'border-destructive/25 bg-white/[0.02]'
                    : 'border-white/10 bg-white/[0.02]'
              )}
            >
              {/* The same slab the week list, the games and the header
                  all use — smallest instance of it. */}
              <div
                aria-hidden
                className="relative flex w-11 shrink-0 items-center justify-center self-stretch"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, calc(100% - 7px) 100%, 0 100%)',
                  background: won
                    ? 'linear-gradient(150deg, rgba(0,217,255,0.17), rgba(0,217,255,0.03))'
                    : lost
                      ? 'linear-gradient(150deg, rgba(255,105,180,0.17), rgba(255,105,180,0.03))'
                      : 'linear-gradient(150deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))',
                }}
              >
                <span
                  className={cn(
                    'font-display -mr-1 text-lg leading-none tabular-nums',
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

              <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2.5 pl-2">
                {leg ? (
                  <>
                    <span className="text-foreground/85 min-w-0 flex-1 truncate text-xs">
                      {leg.description}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11px] font-bold tabular-nums">
                      {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                    </span>
                    <ResultMark result={leg.result} />
                  </>
                ) : (
                  <span className="text-muted-foreground/50 flex-1 text-xs italic">
                    no pick
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            Nothing on record for this season.
          </p>
        )}
      </div>
    </div>
  )
}

/** A trophy means a win everywhere in this app; a tick would mean
 *  "submitted", which is a different thing entirely. */
function ResultMark({ result }: { result: 'win' | 'loss' | 'push' | null }) {
  if (result === 'win') return <Trophy className="text-neon-blue h-3.5 w-3.5 shrink-0" />
  if (result === 'loss')
    return <Skull className="text-destructive h-3.5 w-3.5 shrink-0" />
  if (result === 'push')
    return <Minus className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
  return <span className="w-3.5 shrink-0" />
}
