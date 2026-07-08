'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Lock, Trophy, Zap } from 'lucide-react'
import { WeekDetailSheet, type WeekDetailData } from '@/components/week-detail-sheet'

interface SeasonFormStripProps {
  /** Past + current week parlay summaries (chronological). */
  weeks: WeekDetailData[]
  leagueId: string
  membersCount: number
  /** Index into `weeks` of the in-flight week, or -1 if none. */
  currentWeekIndex: number
}

// NFL season has 22 slots — 18 regular + 4 post-season. Mirrors the mock
// adapter's `NFL_WEEKS_PER_SEASON`.
const SEASON_WEEKS = 22

/**
 * Season-form ring strip. One tile per NFL week — past weeks render a stacked
 * arc donut (`wins / losses` of the league parlay), current week pulses, and
 * unplayed weeks sit as faded dashed rings. Disambiguates from personal W/L
 * by leading with a league avatar header and using a ring primitive instead
 * of letters.
 *
 *   - won   → full green ring · trophy center
 *   - lost  → green-arc / pink-arc donut · "9/12" fraction
 *   - mixed → green-arc / pink-arc / gray pending · fraction
 *   - locked → full blue ring · lock icon
 *   - open  → dashed ring at submission ratio · live dot
 *   - future → empty dashed ring · week number only
 */
export function SeasonFormStrip({
  weeks,
  leagueId,
  membersCount,
  currentWeekIndex,
}: SeasonFormStripProps) {
  const [active, setActive] = useState<WeekDetailData | null>(null)

  if (weeks.length === 0 && currentWeekIndex < 0) return null

  // Week-number → WeekDetailData lookup so the strip can render every slot
  // even when future weeks have no parlay record.
  const byWeekNumber = new Map<number, WeekDetailData>()
  weeks.forEach((w) => byWeekNumber.set(w.week.week_number, w))

  // The form strip's "current" anchor is the active parlay's week number;
  // future weeks render past it.
  const currentWeekNumber =
    currentWeekIndex >= 0 ? weeks[currentWeekIndex]?.week.week_number ?? -1 : -1

  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-2">
          Season
        </p>
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 py-1">
            {Array.from({ length: SEASON_WEEKS }, (_, i) => {
              const weekNumber = i + 1
              const data = byWeekNumber.get(weekNumber) ?? null
              const isCurrent = weekNumber === currentWeekNumber
              const isFuture = !data && weekNumber > currentWeekNumber
              return (
                <WeekTile
                  key={weekNumber}
                  weekNumber={weekNumber}
                  data={data}
                  isCurrent={isCurrent}
                  isFuture={isFuture}
                  membersCount={membersCount}
                  onClick={() => data && setActive(data)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {active && (
        <WeekDetailSheet
          open={active !== null}
          onClose={() => setActive(null)}
          data={active}
          leagueId={leagueId}
          membersCount={membersCount}
        />
      )}
    </>
  )
}

// ─── Per-week tile ──────────────────────────────────────────────────────────

interface WeekTileProps {
  weekNumber: number
  data: WeekDetailData | null
  isCurrent: boolean
  isFuture: boolean
  membersCount: number
  onClick: () => void
}

function WeekTile({
  weekNumber,
  data,
  isCurrent,
  isFuture,
  membersCount,
  onClick,
}: WeekTileProps) {
  const interactive = !!data
  const Tag = interactive ? 'button' : 'div'

  const base =
    'shrink-0 flex flex-col items-center gap-1 rounded-lg ring-1 ring-inset px-1.5 py-1.5 min-w-[52px] transition-all'
  const tone = isCurrent
    ? 'ring-neon-blue/40 bg-neon-blue/[0.04] hover:bg-neon-blue/[0.08]'
    : isFuture
      ? 'ring-white/5 bg-transparent opacity-50'
      : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className={cn(base, tone, !interactive && 'cursor-default')}
      aria-label={
        data
          ? `Week ${weekNumber} — ${labelFor(data, membersCount)}`
          : `Week ${weekNumber} — not yet played`
      }
    >
      <WeekRing data={data} isCurrent={isCurrent} membersCount={membersCount} />
      <span
        className={cn(
          'text-[10px] font-bold tracking-widest uppercase tabular-nums leading-none',
          isCurrent ? 'text-neon-blue' : 'text-muted-foreground/70'
        )}
      >
        {weekNumber}
      </span>
    </Tag>
  )
}

// ─── Ring SVG ───────────────────────────────────────────────────────────────

const SIZE = 36
const STROKE = 4
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface WeekRingProps {
  data: WeekDetailData | null
  isCurrent: boolean
  membersCount: number
}

function WeekRing({ data, isCurrent, membersCount }: WeekRingProps) {
  // Future / placeholder ring
  if (!data) {
    return (
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray="2 3"
          className="text-white/15"
        />
      </svg>
    )
  }

  const { parlayState, weekStats, submissionCount } = data
  const total = membersCount || 1

  // Open/in-flight current week → dashed ring with submission ratio + live dot
  if (parlayState === 'open') {
    const ratio = submissionCount / total
    const filled = ratio * CIRCUMFERENCE
    return (
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="overflow-visible"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray="2 3"
          className="text-neon-blue/30"
        />
        {filled > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="text-neon-blue"
          />
        )}
        <foreignObject x={0} y={0} width={SIZE} height={SIZE}>
          <div className="h-full w-full flex items-center justify-center">
            {isCurrent ? (
              <Zap className="h-3.5 w-3.5 text-neon-blue" />
            ) : (
              <span className="text-[8px] font-bold tabular-nums text-muted-foreground">
                {submissionCount}/{total}
              </span>
            )}
          </div>
        </foreignObject>
      </svg>
    )
  }

  // Locked (all in, awaiting kickoff) → full blue + lock icon
  if (parlayState === 'locked') {
    return (
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-neon-blue/70"
        />
        <foreignObject x={0} y={0} width={SIZE} height={SIZE}>
          <div className="h-full w-full flex items-center justify-center">
            <Lock className="h-3.5 w-3.5 text-neon-blue" />
          </div>
        </foreignObject>
      </svg>
    )
  }

  // Graded / won / lost → stacked-arc donut. Denominator is the count of
  // people who actually bet — slackers don't dilute the stat.
  const wins = weekStats.wins
  const losses = weekStats.losses
  const denom = data.submissionCount || 1
  const winsArc = (wins / denom) * CIRCUMFERENCE
  const lossArc = (losses / denom) * CIRCUMFERENCE
  const isWin = parlayState === 'won'

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        className="text-white/8"
      />
      {/* Wins arc */}
      {wins > 0 && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={`${winsArc} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="text-neon-blue"
        />
      )}
      {/* Losses arc — picks up after wins */}
      {losses > 0 && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={`${lossArc} ${CIRCUMFERENCE}`}
          strokeDashoffset={-winsArc}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="text-destructive"
        />
      )}
      <foreignObject x={0} y={0} width={SIZE} height={SIZE}>
        <div className="h-full w-full flex items-center justify-center">
          {isWin ? (
            <Trophy className="h-3 w-3 text-neon-blue" />
          ) : (
            <span className="text-[9px] font-bold tabular-nums text-foreground/90 leading-none">
              {wins}/{denom}
            </span>
          )}
        </div>
      </foreignObject>
    </svg>
  )
}

const labelFor = (data: WeekDetailData, members: number): string => {
  switch (data.parlayState) {
    case 'won':
      return `League won ${data.weekStats.wins} of ${members}`
    case 'lost':
      return `League lost · ${data.weekStats.wins} of ${members} hit`
    case 'graded':
      return `Grading · ${data.weekStats.wins}W ${data.weekStats.losses}L`
    case 'locked':
      return 'Locked, awaiting kickoff'
    case 'open':
      return `${data.submissionCount} of ${members} in`
    default:
      return data.parlayState
  }
}
