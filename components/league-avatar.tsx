import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeagueAvatarProps {
  leagueId: string
  /** League name — renders initials when provided. */
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Initials from a league name — first letters of the first two words. */
export function leagueInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase()
}

/**
 * League badge placeholder — league-name initials (or a muted Trophy
 * glyph when no name is given) in a neutral glass circle. When we pull
 * real league art from Sleeper, this is the seam to swap (leagueId maps
 * to the Sleeper avatar).
 */
export function LeagueAvatar({
  leagueId,
  name,
  size = 'md',
  className,
}: LeagueAvatarProps) {
  void leagueId
  const dim =
    size === 'sm'
      ? { wrap: 'h-9 w-9 rounded-full', icon: 'h-4 w-4', text: 'text-[11px]' }
      : size === 'lg'
        ? { wrap: 'h-14 w-14 rounded-full', icon: 'h-7 w-7', text: 'text-lg' }
        : { wrap: 'h-11 w-11 rounded-full', icon: 'h-5 w-5', text: 'text-sm' }

  return (
    <div
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center ring-1 ring-white/15 bg-white/[0.06]',
        dim.wrap,
        className
      )}
    >
      {name ? (
        <span className={cn('font-bold text-foreground/80', dim.text)}>
          {leagueInitials(name)}
        </span>
      ) : (
        <Trophy className={cn(dim.icon, 'text-muted-foreground')} />
      )}
    </div>
  )
}
