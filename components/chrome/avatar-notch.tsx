'use client'

import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import { ArcLabel } from '@/components/chrome/arc-label'
import { openPanel, subscribePanel } from '@/components/chrome/canvas-store'
import { PROFILE_C, PROFILE_R } from '@/components/chrome/bubble-layout'

const initials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

/**
 * YOU: your avatar floating in a bite punched out of the card's RIGHT
 * edge (the hole itself is .page-sheet-card's clip — nothing is painted
 * here). Rendered inside .page-sheet so it rides the card's every slide.
 *
 * Opens the profile sheet, and only that — your face is a door to YOU.
 * The league itself lives behind the masthead's season lockup.
 */
export function AvatarNotch() {
  const chrome = useLeagueChrome()
  const [open, setOpen] = useState(false)
  useEffect(() => subscribePanel((p) => setOpen(p === 'profile')), [])

  if (!chrome) return null

  return (
    <button
      type="button"
      data-sheet-bubble
      onClick={() => openPanel('profile')}
      aria-label={open ? 'Close your profile' : 'Your profile'}
      aria-expanded={open}
      className="group hidden focus-visible:outline-none lg:block"
      style={{
        // Box height 50 centred on the shared bite centre (bubble-layout).
        position: 'absolute',
        top: PROFILE_C - PROFILE_R,
        right: 0,
        transform: 'translateX(50%)',
        width: 50,
        height: 50,
        zIndex: 40,
      }}
    >
      {/* PROFILE curved around the bite — the right-edge twin of the
          rail's stamps, on the card side to the bite's LEFT. */}
      <ArcLabel
        text="PROFILE"
        cx={37}
        cy={37}
        r={31.5}
        side="left"
        boxW={74}
        boxH={74}
        inset={12}
        fontSize={7}
        bias={1.2}
      />
      <span
        className="group-focus-visible:ring-white absolute flex items-center justify-center rounded-full group-focus-visible:ring-2"
        style={{ left: 6, top: 6, width: 38, height: 38 }}
      >
        {open ? (
          <span aria-hidden className="text-foreground text-[1.1rem] leading-none">
            ✕
          </span>
        ) : (
          <Avatar className="h-[38px] w-[38px] ring-2 ring-primary/50 transition-all group-hover:ring-primary">
            <AvatarImage
              src={chrome.me.avatarUrl ?? undefined}
              alt={chrome.me.fullName ?? chrome.me.email}
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
              {initials(chrome.me.fullName, chrome.me.email)}
            </AvatarFallback>
          </Avatar>
        )}
      </span>
    </button>
  )
}
