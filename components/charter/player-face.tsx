'use client'

/**
 * A PLAYER'S FACE — Sleeper's headshot, with the fallback it needs.
 *
 * Sleeper 404s for anybody it has no photo of (rookies who haven't shot
 * one yet, and anybody typed by hand who never resolved to a catalogue
 * entry), and a 404 in an <img> renders as the browser's broken-image
 * glyph, which is worse than initials.
 *
 * The crop is deliberate. Those headshots put the face in about the top
 * 40% of the frame with a lot of jersey underneath, so a plain
 * object-cover in a circle is mostly shoulder — the scale and origin pull
 * it back to the head. Lifted from Dynastly's PlayerAvatar, which learnt
 * the same thing.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function PlayerFace({
  sleeperId,
  name,
  className,
}: {
  sleeperId: string | null
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const show = sleeperId && !failed

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.05]',
        'text-muted-foreground text-[9px] font-bold',
        className
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full origin-[50%_38%] scale-[1.35] object-cover"
        />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </span>
  )
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
