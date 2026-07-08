'use client'

import { cn } from '@/lib/utils'

interface OddsInputProps {
  value: number
  onChange: (v: number) => void
  /** League cap (default -200). Anything more negative is rejected. */
  min?: number
  /** League cap (default +200). Anything more positive is rejected. */
  max?: number
  step?: number
}

// Shortlist of common American odds values inside the [-200, +200] range —
// quick-tap presets keep the slider from being the only path to common bets.
const PRESETS = [-200, -150, -110, 100, 110, 150, 200] as const

// Bet lines below 100 absolute value aren't valid American odds; snap the
// slider thumb past the dead zone so the user can't land there.
const DEAD_MIN = -100
const DEAD_MAX = 100

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`)

const snapPastDeadZone = (raw: number, prev: number): number => {
  if (raw <= DEAD_MIN || raw >= DEAD_MAX) return raw
  // Pick the nearer edge; if user is dragging, prefer the direction of travel.
  const goingPositive = raw > prev
  return goingPositive ? DEAD_MAX : DEAD_MIN
}

/**
 * Capped American-odds picker. Slider + value display + preset chips. The
 * caps mirror the league-rule that nobody can submit a leg below -200 or
 * above +200 — slider physically can't go outside that range, and odd
 * step-of-5 keeps the thumb landing on plausible book lines.
 */
export function OddsInput({
  value,
  onChange,
  min = -200,
  max = 200,
  step = 5,
}: OddsInputProps) {
  // Range pct for the colored fill behind the thumb.
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
          Odds
        </span>
        <span
          className={cn(
            'text-2xl font-bold tabular-nums leading-none',
            value < 0 ? 'text-foreground' : 'text-neon-blue'
          )}
        >
          {fmt(value)}
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(snapPastDeadZone(Number(e.target.value), value))}
          aria-label="Odds"
          className="odds-slider w-full"
          style={
            {
              ['--pct' as string]: `${pct}%`,
            } as React.CSSProperties
          }
        />
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground/60">
          <span>{fmt(min)}</span>
          <span className="text-muted-foreground/40">±100</span>
          <span>{fmt(max)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = value === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-bold tabular-nums transition-all',
                active
                  ? 'border-neon-blue/60 bg-neon-blue/10 text-neon-blue'
                  : 'border-white/10 text-foreground/80 hover:border-neon-blue/40 hover:bg-white/5'
              )}
            >
              {fmt(p)}
            </button>
          )
        })}
      </div>

      <style jsx>{`
        .odds-slider {
          appearance: none;
          height: 6px;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0.12) 0%,
            rgba(255, 255, 255, 0.12) var(--pct, 50%),
            rgba(255, 255, 255, 0.04) var(--pct, 50%),
            rgba(255, 255, 255, 0.04) 100%
          );
          border-radius: 999px;
          outline: none;
        }
        .odds-slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 999px;
          background: #00d9ff;
          box-shadow:
            0 0 0 3px rgba(0, 217, 255, 0.18),
            0 0 12px rgba(0, 217, 255, 0.5);
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .odds-slider::-webkit-slider-thumb:active {
          transform: scale(1.12);
        }
        .odds-slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border: none;
          border-radius: 999px;
          background: #00d9ff;
          box-shadow:
            0 0 0 3px rgba(0, 217, 255, 0.18),
            0 0 12px rgba(0, 217, 255, 0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
