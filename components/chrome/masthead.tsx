'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDown } from 'lucide-react'
import {
  closePanel,
  openPanel,
  setStageView,
  setViewedWeek,
  subscribePanel,
} from '@/components/chrome/canvas-store'
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
 * Two postures, and they hold different numbers of things.
 *
 *   DESKTOP: two lockups, two nouns — the wordmark on the left, the
 *   SEASON on the right (the door to the league and everything about
 *   it: the year, who's in, who runs it, the settings, the history).
 *
 *   MOBILE: the full lockup owns the left, YOU own the right, and
 *   that's all. The season moved down to the dock, where RoarTracker
 *   keeps it — a phone strip holding brand AND season AND avatar made
 *   the app's own name the smallest thing on it, squeezed to two
 *   letters beside a neon year twice its size.
 *
 * The week is never named up here — that's the dock's job, and naming
 * it twice is how a shell gets muddy.
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
        {/* HOME, and home is the week the season is actually on.
            It keeps its href so it still behaves like a link — middle
            click, open in a new tab, the status bar — but a plain click
            is handled here instead: the shell is one page, so going home
            is putting its state back, not fetching anything. */}
        <Link
          href="/"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
            e.preventDefault()
            closePanel()
            // Unpinned, both of these fall back to what the season says:
            // its current week, on the week stage — or the recap, if the
            // season is over and there's no current week to be on.
            setViewedWeek(null)
            setStageView(null)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="group shrink-0"
        >
          {/* The two halves TRADE colours on hover rather than one of
              them changing — they're one lockup, and half of it moving
              read as a glitch. Slow, because at this size an instant
              swap is a flash. */}
          {/* STACKED on a phone, one line from sm up. The name is
              twenty condensed caps — at 390px it either wraps, shrinks
              to nothing, or gets abbreviated to "DD", and abbreviating
              is what it used to do: the app's own name reduced to two
              letters so a season picker could have the middle. Two
              lines is the same lockup, whole, at a size you can read. */}
          <h1 className="flex flex-col leading-[0.82] font-bold whitespace-nowrap sm:flex-row sm:items-center sm:gap-2 sm:leading-none">
            <span className="text-neon-blue group-hover:text-neon-pink relative z-10 text-[1.4rem] tracking-tight transition-colors duration-500 ease-out sm:text-3xl lg:text-[2.6rem]">
              DEGENERATES
            </span>
            <span className="text-neon-pink group-hover:text-neon-blue relative z-0 text-[1.4rem] tracking-tight transition-colors duration-500 ease-out sm:text-3xl lg:text-[2.6rem]">
              DASHBOARD
            </span>
          </h1>
        </Link>

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
function SeasonLockup({ season, className }: { season: string; className?: string }) {
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
      <span className="flex items-center gap-2">
        <span className="text-neon-blue text-3xl tracking-tight lg:text-[2.6rem]">
          {seasonLabel(season)}
        </span>
        <span className="text-neon-pink text-3xl tracking-tight lg:text-[2.6rem]">
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
