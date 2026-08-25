'use client'

/**
 * THE KEEPER RULES — the draft's small print, on its own.
 *
 * This was the right-hand half of a card whose left half was the date,
 * the place and the format. That half is the page's hero now, so what's
 * left is the five things that only matter once you're at the table:
 * how many you can hold, what it costs, how long, what happens to a
 * traded pick, and when you have to say.
 *
 * Set as reference material — label, dotted leader, value — because
 * that's what it is. Nobody reads this for pleasure; they look one line
 * up mid-argument. Pressing a line opens the book at it.
 */

import { openCharterGroup } from '@/components/chrome/canvas-store'
import { cn } from '@/lib/utils'

export interface KeeperEntry {
  id: string
  key: string
  label: string
  value: string | null
  status: 'draft' | 'pending' | 'locked'
}

/** The five, in reading order — the order you'd hit them in an argument. */
const KEEPER_KEYS = [
  'keeper-slots',
  'keeper-cost',
  'keeper-restrictions',
  'keeper-traded-pick',
  'keeper-deadline',
] as const

export function KeepersCard({ entries }: { entries: KeeperEntry[] }) {
  const keepers = KEEPER_KEYS.map((k) => entries.find((e) => e.key === k)).filter(
    (e): e is KeeperEntry => e != null
  )
  if (keepers.length === 0) return null

  return (
    <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <p className="text-muted-foreground/60 mb-2.5 text-[9px] font-bold tracking-[0.3em] uppercase">
        Keepers
      </p>
      {/* Three across at full width. Five short pairs in one column left
          a card that was mostly margin. */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {keepers.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => openCharterGroup('Draft', e.id)}
            className="group flex items-baseline gap-2 text-left"
          >
            <span className="text-muted-foreground/70 group-hover:text-foreground/70 shrink-0 text-[11px] transition-colors">
              {e.label}
            </span>
            <span
              aria-hidden
              className="min-w-3 flex-1 translate-y-[-2px] border-b border-dotted border-white/10"
            />
            <span
              className={cn(
                'shrink-0 text-right text-[11px] font-semibold',
                e.status === 'locked'
                  ? 'text-foreground/85'
                  : 'text-muted-foreground/50 italic'
              )}
            >
              {e.status === 'locked' ? e.value : 'Awaiting'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
