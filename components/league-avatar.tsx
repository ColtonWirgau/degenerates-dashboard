import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeagueAvatarProps {
  leagueId: string
  /** Kept for back-compat; no longer rendered (no initials). */
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * League badge placeholder — a muted Trophy glyph in a neutral glass
 * circle. Deliberately quiet: it reads as "no image yet", not a design
 * choice. When we pull real league art from Sleeper, this is the seam
 * to swap (leagueId maps to the Sleeper avatar).
 */
export function LeagueAvatar({ leagueId, size = 'md', className }: LeagueAvatarProps) {
  void leagueId
  const dim =
    size === 'sm'
      ? { wrap: 'h-9 w-9 rounded-full', icon: 'h-4 w-4' }
      : size === 'lg'
        ? { wrap: 'h-14 w-14 rounded-full', icon: 'h-7 w-7' }
        : { wrap: 'h-11 w-11 rounded-full', icon: 'h-5 w-5' }

  return (
    <div
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center ring-1 ring-white/15 bg-white/[0.06]',
        dim.wrap,
        className
      )}
    >
      <Trophy className={cn(dim.icon, 'text-muted-foreground')} />
    </div>
  )
}
