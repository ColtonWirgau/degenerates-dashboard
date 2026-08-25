'use client'

/**
 * DRAFT DAY — the one charter group whose shape is known in advance.
 *
 * Every other group is a bag of label/value pairs, and a list is the
 * honest way to show a bag. The draft isn't: it's always a date, always a
 * place, always a format, and always the same five keeper rules. That's a
 * fixture, and a fixture wants to look like one — the date big enough to
 * read across a room, the two facts you'd text someone next to it, and
 * the rules that only matter once you're in the room underneath.
 *
 * It degrades on purpose. Values are free text typed by whoever settled
 * them, so the date parser is tolerant and every missing field either
 * falls back to its raw string or says TBD. A draft nobody has settled
 * yet still renders — as an empty fixture waiting to be filled in, which
 * is a truer picture than hiding it.
 */

import { CalendarDays, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DraftEntry {
  key: string
  label: string
  value: string | null
  status: 'draft' | 'pending' | 'locked'
}

/** The five that only matter once you're at the table, in reading order. */
const KEEPER_KEYS = [
  'keeper-slots',
  'keeper-cost',
  'keeper-restrictions',
  'keeper-traded-pick',
  'keeper-deadline',
] as const

/**
 * "Mon, Aug 31 · 8:30pm" → its parts. Anything that doesn't match comes
 * back whole, because a value the league typed by hand is still the
 * truth even when it isn't the shape we hoped for.
 */
function parseWhen(value: string | null): {
  weekday: string | null
  month: string | null
  day: string | null
  time: string | null
  raw: string | null
} {
  if (!value) return { weekday: null, month: null, day: null, time: null, raw: null }
  const m = value.match(
    /^\s*(\w{3})\w*,?\s+(\w{3})\w*\.?\s+(\d{1,2})\s*(?:·|-|—|@|at)?\s*(.*)$/i
  )
  if (!m) return { weekday: null, month: null, day: null, time: null, raw: value }
  return {
    weekday: m[1]!.toUpperCase(),
    month: m[2]!.toUpperCase(),
    day: m[3]!,
    time: m[4]?.trim() || null,
    raw: value,
  }
}

export function DraftCard({
  entries,
  onOpenEntry,
}: {
  entries: DraftEntry[]
  /** Open the group sheet on one item — same door the list rows used. */
  onOpenEntry: (key: string) => void
}) {
  const by = (k: string) => entries.find((e) => e.key === k) ?? null
  const valueOf = (k: string) => {
    const e = by(k)
    return e && e.status === 'locked' ? e.value : null
  }

  const when = parseWhen(valueOf('draft-date'))
  const where = valueOf('draft-location')
  const format = valueOf('draft-format')
  const keepers = KEEPER_KEYS.map((k) => by(k)).filter((e): e is DraftEntry => e != null)
  const settled = when.raw != null

  return (
    <div>
      {/* THE FIXTURE. Date on its slab, the two facts you'd text someone
          beside it. */}
      <div className="flex items-stretch border-b border-white/10">
        <button
          type="button"
          onClick={() => onOpenEntry('draft-date')}
          aria-label={`Draft date — ${when.raw ?? 'not set'}`}
          className="relative flex w-[6.5rem] shrink-0 flex-col items-center justify-center self-stretch py-3 transition-[filter] hover:brightness-125"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 11px) 100%, 0 100%)',
            background: settled
              ? 'linear-gradient(150deg, rgba(0,217,255,0.20), rgba(0,217,255,0.04))'
              : 'linear-gradient(150deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))',
          }}
        >
          {when.day ? (
            <>
              <span className="text-neon-blue/80 -mr-1.5 text-[0.6rem] font-bold tracking-[0.25em] uppercase">
                {when.month}
              </span>
              <span className="font-display text-neon-blue -mr-1.5 text-[2.6rem] leading-[0.9] tabular-nums">
                {when.day}
              </span>
              <span className="text-muted-foreground -mr-1.5 text-[0.6rem] font-bold tracking-[0.25em] uppercase">
                {when.weekday}
              </span>
            </>
          ) : (
            <span className="font-display text-foreground/35 -mr-1.5 text-[1.6rem] leading-none">
              TBD
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3 pr-3 pl-3.5">
          <Fact
            icon={CalendarDays}
            value={when.day ? when.time : when.raw}
            fallback="Date not settled"
            onClick={() => onOpenEntry('draft-date')}
            strong
          />
          <Fact
            icon={MapPin}
            value={where}
            fallback="Location not settled"
            onClick={() => onOpenEntry('draft-location')}
            strong
          />
          {format && (
            <p className="text-muted-foreground truncate text-[11px] tracking-wider uppercase">
              {format}
            </p>
          )}
        </div>
      </div>

      {/* THE RULES, in two columns — they're reference material, not
          headlines, so they're set like reference material. */}
      {keepers.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="text-muted-foreground/60 mb-2 text-[9px] font-bold tracking-[0.3em] uppercase">
            Keepers
          </p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
            {keepers.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => onOpenEntry(e.key)}
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
      )}
    </div>
  )
}

/** One headline fact — an icon, the value, and a plain admission when
 *  there isn't one yet. */
function Fact({
  icon: Icon,
  value,
  fallback,
  onClick,
  strong = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string | null
  fallback: string
  onClick: () => void
  strong?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-2 text-left"
    >
      <Icon className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
      <span
        className={cn(
          'min-w-0 truncate transition-colors',
          value
            ? strong
              ? 'text-foreground/90 text-sm font-semibold'
              : 'text-foreground/80 text-xs'
            : 'text-muted-foreground/50 text-xs italic'
        )}
      >
        {value ?? fallback}
      </span>
    </button>
  )
}
