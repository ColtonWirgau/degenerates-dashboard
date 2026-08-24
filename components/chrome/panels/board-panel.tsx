'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
 * The BOARD panel: the season leaderboard, you highlighted. Rows carry the
 * record and hit rate; rank comes from the given order.
 */
export function BoardPanel({
  entries,
  currentUserId,
}: {
  entries: BoardPanelEntry[]
  currentUserId: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        Leaderboard
      </p>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {entries.map((e, i) => {
          const isMe = e.userId === currentUserId
          return (
            <div
              key={e.userId}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
                isMe
                  ? 'border-neon-blue/40 bg-neon-blue/10'
                  : 'border-white/10 bg-white/[0.02]'
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
                <AvatarImage src={e.avatarUrl ?? undefined} alt={e.fullName ?? e.email} />
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
            </div>
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
