'use client'

/**
 * WHO'S KEEPING WHOM — twelve small cards.
 *
 * The charter's `eligible-keepers` row said "12 rosters · tap to view"
 * and pointed at a table that had never been written: the roster shape
 * lived only in the mock generator, so on real data the condition that
 * rendered it was always false. Twelve rosters, none of them anywhere.
 *
 * Keepers are RECORDS, not decisions — one per person per season — so
 * they're rows in their own table now, and this is the board. The RULES
 * stay in the charter above, because those are voted on.
 *
 * A GRID, not a list. Twelve rows of name-then-blank was a column of
 * whitespace as tall as the page for twelve short facts, and the thing
 * you actually want off it is a glance: who's in, who isn't, and what
 * they're holding. Twelve cards give you that in one look.
 *
 * Nothing here is a form. Declaring happens in THE KEEPER sheet off the
 * action pod, which is where this app puts every other verb — a card
 * that quietly doubles as an editor is a card you can't trust to be a
 * record.
 */

import { openPanel } from '@/components/chrome/canvas-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlayerFace } from '@/components/charter/player-face'
import { cn } from '@/lib/utils'

export interface KeeperBoardPerson {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

export interface KeeperBoardRow {
  id: string
  userId: string
  playerName: string
  position: string | null
  sleeperId: string | null
  roundCost: number | null
  yearOfKeep: number
}

export function KeeperBoard({
  people,
  keepers,
  currentUserId,
  canManage,
}: {
  people: KeeperBoardPerson[]
  keepers: KeeperBoardRow[]
  currentUserId: string
  canManage: boolean
}) {
  const byUser = new Map<string, KeeperBoardRow[]>()
  for (const k of keepers) {
    byUser.set(k.userId, [...(byUser.get(k.userId) ?? []), k])
  }

  // You first, then everyone who's declared, then everyone who hasn't.
  // Grouped, the empties read as "these people still owe you an answer"
  // instead of as gaps scattered through a list.
  const others = people.filter((p) => p.userId !== currentUserId)
  const ordered = [
    ...people.filter((p) => p.userId === currentUserId),
    ...others.filter((p) => (byUser.get(p.userId)?.length ?? 0) > 0),
    ...others.filter((p) => (byUser.get(p.userId)?.length ?? 0) === 0),
  ]

  return (
    <div id="keeper-board" className="mb-8">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-muted-foreground/60 text-[9px] font-bold tracking-[0.3em] uppercase">
          Keepers
        </p>
        <p className="text-muted-foreground/50 text-[10px] tabular-nums">
          {byUser.size}/{people.length} in
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {ordered.map((p) => {
          const theirs = byUser.get(p.userId) ?? []
          const mine = p.userId === currentUserId
          const keeper = theirs[0] ?? null
          // Yours is always a door. Everyone else's is one only if you
          // run the league — otherwise it's a fact about them, and a
          // card that looks pressable and isn't is a small lie.
          const openable = mine || canManage

          const body = (
            <>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Avatar className="h-4 w-4 shrink-0 ring-1 ring-white/10">
                  <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/70 text-primary-foreground text-[7px] font-bold">
                    {initials(p.fullName, p.email)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'min-w-0 truncate text-[10px] font-bold tracking-wider uppercase',
                    mine ? 'text-neon-blue/80' : 'text-muted-foreground/60'
                  )}
                >
                  {firstName(p.fullName, p.email)}
                </span>
                {keeper?.roundCost != null && (
                  <span className="text-muted-foreground/50 ml-auto shrink-0 text-[10px] font-bold tabular-nums">
                    R{keeper.roundCost}
                  </span>
                )}
              </div>

              {keeper ? (
                <div className="flex items-center gap-2">
                  <PlayerFace
                    sleeperId={keeper.sleeperId}
                    name={keeper.playerName}
                    className="h-9 w-9"
                  />
                  <div className="min-w-0">
                    <p className="text-foreground/90 truncate text-[13px] leading-tight font-semibold">
                      {keeper.playerName}
                    </p>
                    <p className="text-muted-foreground/60 truncate text-[10px] font-bold tracking-[0.1em] uppercase">
                      {[keeper.position, keeper.yearOfKeep > 1 && `yr ${keeper.yearOfKeep}`]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-9 w-9 shrink-0 rounded-full border border-dashed border-white/12" />
                  <p className="text-muted-foreground/40 text-[12px] italic">
                    {mine ? 'Declare yours' : 'Not in yet'}
                  </p>
                </div>
              )}
            </>
          )

          const shell = cn(
            'rounded-lg border px-2.5 py-2 text-left transition-colors',
            mine
              ? 'border-neon-blue/30 bg-neon-blue/[0.06]'
              : keeper
                ? 'border-white/10 bg-white/[0.02]'
                : 'border-dashed border-white/10 bg-transparent'
          )

          return openable ? (
            <button
              key={p.userId}
              type="button"
              onClick={() => openPanel('keeper')}
              aria-label={
                keeper
                  ? `${firstName(p.fullName, p.email)} keeps ${keeper.playerName} — open the keeper sheet`
                  : `${firstName(p.fullName, p.email)} has no keeper — open the keeper sheet`
              }
              className={cn(shell, 'hover:border-neon-blue/40 hover:bg-white/[0.05]')}
            >
              {body}
            </button>
          ) : (
            <div key={p.userId} className={shell}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function firstName(name: string | null, email: string): string {
  return name?.split(' ')[0] ?? email.split('@')[0] ?? email
}
