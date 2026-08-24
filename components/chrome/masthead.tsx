'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDown } from 'lucide-react'
import {
  openLeagueSheet,
  openSeasonSheet,
  subscribeSeasonSheet,
} from '@/components/chrome/canvas-store'
import { seasonLabel } from '@/components/chrome/season-sheet'
import { cn } from '@/lib/utils'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import { leagueInitials } from '@/components/league-avatar'

const initials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

/**
 * The shell's masthead — sits ON the canvas (not the card) and holds
 * still while the card slides. Mobile: wordmark + your avatar (opens the
 * league sheet). Desktop: wordmark + league name + season/week chip; the
 * avatar lives in the card's edge notch instead.
 */
export function Masthead() {
  const chrome = useLeagueChrome()
  if (!chrome) return null

  return (
    <header
      className="relative z-50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:h-16 lg:px-11">
        <Link href="/" className="group shrink-0">
          <h1 className="flex items-center leading-none font-bold whitespace-nowrap sm:gap-2">
            <span className="text-neon-blue group-hover:text-primary relative z-10 text-3xl tracking-[-0.18em] transition-colors sm:text-2xl sm:tracking-tight">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DEGENERATES</span>
            </span>
            <span className="text-neon-pink group-hover:text-neon-blue relative z-0 text-3xl tracking-tight transition-colors sm:text-2xl">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DASHBOARD</span>
            </span>
          </h1>
        </Link>

        {/* Mobile: you + the league badge, opening the combined sheet. */}
        <SeasonLockup
          season={chrome.season}
          weekNumber={chrome.weekNumber}
          className="lg:hidden"
          compact
        />

        <button
          type="button"
          onClick={openLeagueSheet}
          aria-label={`${chrome.me.fullName ?? chrome.me.email} — ${chrome.leagueName}`}
          className="group relative shrink-0 lg:hidden"
        >
          <Avatar className="ring-primary/50 group-hover:ring-primary h-10 w-10 cursor-pointer ring-2 transition-all">
            <AvatarImage
              src={chrome.me.avatarUrl ?? undefined}
              alt={chrome.me.fullName ?? chrome.me.email}
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold">
              {initials(chrome.me.fullName, chrome.me.email)}
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden
            className="ring-background text-foreground/90 absolute -right-0.5 -bottom-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1e] text-[8px] font-bold ring-2"
          >
            {leagueInitials(chrome.leagueName)}
          </span>
        </button>

        {/* Desktop: the strip's other lockup — same face and weight as
            DEGENERATES DASHBOARD on the left, so the band's two ends
            answer each other. It's also the control that opens the
            season sheet (league + year + setup). */}
        <SeasonLockup
          season={chrome.season}
          weekNumber={chrome.weekNumber}
          className="hidden lg:inline-flex"
        />
      </div>
    </header>
  )
}

/**
 * The masthead's other lockup: "{year} SEASON ⌄" in the wordmark's own
 * duotone grammar — the year in electric blue, SEASON in hot pink — so
 * the strip's right end answers DEGENERATES DASHBOARD on its left. It
 * opens the season sheet (year, league, and off-season setup).
 */
function SeasonLockup({
  season,
  weekNumber,
  className,
  compact = false,
}: {
  season: string
  weekNumber: number | null
  className?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => subscribeSeasonSheet(setOpen), [])

  return (
    <button
      type="button"
      onClick={openSeasonSheet}
      aria-expanded={open}
      aria-label="Season, league and setup"
      className={cn(
        'group inline-flex shrink-0 items-center gap-1.5 leading-none font-bold whitespace-nowrap transition-opacity hover:opacity-80',
        className
      )}
    >
      <span
        className={cn(
          'text-neon-blue tracking-tight',
          compact ? 'text-xl' : 'text-2xl'
        )}
      >
        {seasonLabel(season)}
      </span>
      <span
        className={cn(
          'text-neon-pink tracking-tight',
          compact ? 'text-xl' : 'text-2xl'
        )}
      >
        {weekNumber != null ? `WK${weekNumber}` : 'SEASON'}
      </span>
      <ChevronDown
        className={cn(
          'text-muted-foreground h-3.5 w-3.5 transition-transform',
          open && 'rotate-180'
        )}
      />
    </button>
  )
}
