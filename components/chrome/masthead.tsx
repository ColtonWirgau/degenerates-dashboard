'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDown } from 'lucide-react'
import { openPanel, subscribePanel } from '@/components/chrome/canvas-store'
import { cn } from '@/lib/utils'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'

/** "2025-2026" → "2025". The span is implied; the year is the name. */
const seasonLabel = (season: string) => season.split('-')[0] ?? season

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
 * still while the card slides.
 *
 * Two lockups, two nouns. On the left the wordmark. On the right the
 * SEASON — the door to the league and everything about it (the year,
 * who's in, who runs it, the settings, the history). Your face sits
 * beside it at phone width and opens YOU; on desktop it moves down into
 * the card's right-edge notch. The week is never named up here — that's
 * the left rail's job, and naming it twice is how a shell gets muddy.
 */
export function Masthead() {
  const chrome = useLeagueChrome()
  if (!chrome) return null

  return (
    <header
      className="relative z-50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Taller, and set bigger. The band was 64px with 24px type in it,
          which made the app's own name the quietest thing on a screen it
          sits at the top of. px-11 is not arbitrary — it puts both
          lockups exactly on the card's edges below. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:h-24 lg:px-11">
        <Link href="/" className="group shrink-0">
          <h1 className="flex items-center leading-none font-bold whitespace-nowrap sm:gap-2">
            <span className="text-neon-blue group-hover:text-primary relative z-10 text-3xl tracking-[-0.18em] transition-colors sm:text-3xl sm:tracking-tight lg:text-[2.6rem]">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DEGENERATES</span>
            </span>
            <span className="text-neon-pink group-hover:text-neon-blue relative z-0 text-3xl tracking-tight transition-colors sm:text-3xl lg:text-[2.6rem]">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DASHBOARD</span>
            </span>
          </h1>
        </Link>

        {/* Mobile: the season lockup, then your face. */}
        <SeasonLockup season={chrome.season} className="lg:hidden" compact />

        <button
          type="button"
          onClick={() => openPanel('profile')}
          aria-label={`Your profile — ${chrome.me.fullName ?? chrome.me.email}`}
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
        </button>

        {/* Desktop: the strip's other lockup — same face and weight as
            DEGENERATES DASHBOARD on the left, so the band's two ends
            answer each other. It opens the league's own sheet. */}
        <SeasonLockup season={chrome.season} className="hidden lg:inline-flex" />
      </div>
    </header>
  )
}

/**
 * The masthead's other lockup: "{year} SEASON ⌄" in the wordmark's own
 * duotone grammar — the year in electric blue, SEASON in hot pink — so
 * the strip's right end answers DEGENERATES DASHBOARD on its left.
 *
 * It has to ASK for the display face: the wordmark is an <h1> and picks
 * up Anton from the base heading rule in globals, while this is a
 * button, which doesn't. Same face, size, tracking and gap, or the two
 * ends of the band stop rhyming. It
 * opens the league sheet: the year, the members, the settings, the
 * history — everything the league is, as opposed to what you are.
 */
function SeasonLockup({
  season,
  className,
  compact = false,
}: {
  season: string
  className?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => subscribePanel((p) => setOpen(p === 'season')), [])

  return (
    <button
      type="button"
      onClick={() => openPanel('season')}
      aria-expanded={open}
      aria-label="Season and league"
      // The focus ring is spelled out because the browser's own is
      // wrong here. `outline-style: auto` traces the union of a button's
      // child boxes, so this one — two spans with a gap between them —
      // came back as a rounded rect with a notch bitten out of the top
      // and bottom edges at the seam, in the app's cyan (the global
      // `* { outline-ring/50 }` colors the UA ring). A plain offset
      // rectangle is what it was always meant to be.
      className={cn(
        'group font-display inline-flex shrink-0 items-center gap-1.5 rounded-md leading-none font-bold uppercase whitespace-nowrap transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue/70',
        className
      )}
    >
      <span className={cn('flex items-center', compact ? 'gap-1.5' : 'gap-2')}>
        <span
          className={cn(
            'text-neon-blue tracking-tight',
            compact ? 'text-xl' : 'text-3xl lg:text-[2.6rem]'
          )}
        >
          {seasonLabel(season)}
        </span>
        <span
          className={cn(
            'text-neon-pink tracking-tight',
            compact ? 'text-xl' : 'text-3xl lg:text-[2.6rem]'
          )}
        >
          SEASON
        </span>
      </span>
      <ChevronDown
        className={cn(
          'text-muted-foreground h-3.5 w-3.5 transition-transform lg:h-5 lg:w-5',
          open && 'rotate-180'
        )}
      />
    </button>
  )
}
