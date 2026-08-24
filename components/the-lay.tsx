'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionDock } from '@/components/ui/section-dock'
import { deleteLeg } from '@/app/actions/legs'
import { updateLegResult } from '@/app/actions/parlays'
import {
  AlertCircle,
  Check,
  Clock,
  Crosshair,
  Flame,
  Lock,
  Minus,
  Skull,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParlayState } from '@/lib/data/types'
import type { WeekOverviewLeg, WeekOverviewMember } from '@/app/actions/week-overview'

interface TheLayProps {
  weekId: string
  leagueId: string
  legs: WeekOverviewLeg[]
  notSubmittedMembers: WeekOverviewMember[]
  currentUserId: string
  canManage: boolean
  parlayState: ParlayState
  parlayResult: 'won' | 'lost' | null
  totalOdds: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatOdds = (odds: number): string => (odds > 0 ? `+${odds}` : `${odds}`)

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const resultPalette = (result: WeekOverviewLeg['result']) => {
  switch (result) {
    case 'win':
      return {
        cardClass: 'border-neon-blue/40 bg-neon-blue/5',
        text: 'text-neon-blue',
        border: 'border-neon-blue/30',
        label: 'Win',
      }
    case 'loss':
      return {
        cardClass: 'border-destructive/40 bg-destructive/5',
        text: 'text-destructive',
        border: 'border-destructive/30',
        label: 'Loss',
      }
    case 'push':
      return {
        cardClass: 'border-white/15 bg-white/[0.03]',
        text: 'text-foreground/70',
        border: 'border-white/15',
        label: 'Push',
      }
    default:
      return {
        cardClass: 'border-white/10',
        text: 'text-muted-foreground',
        border: 'border-white/10',
        label: 'Pending',
      }
  }
}

// ─── Public ────────────────────────────────────────────────────────────────

/**
 * "The Lay" as a `<SectionDock>`. Collapsed heading carries the combined-
 * odds chip + state-aware result pill. Expanded panel shows the full leg
 * list with admin grading controls. Section body is three feature cards
 * tuned per state — biggest hit/miss, payout, kill-shot, etc.
 */
export function TheLay({
  weekId,
  leagueId,
  legs,
  notSubmittedMembers,
  currentUserId,
  canManage,
  parlayState,
  parlayResult,
  totalOdds,
}: TheLayProps) {
  const router = useRouter()
  const [updatingLegId, setUpdatingLegId] = useState<string | null>(null)
  const [deletingLegId, setDeletingLegId] = useState<string | null>(null)

  const handleDelete = async (legId: string) => {
    if (!confirm('Delete this leg? The user will need to resubmit.')) return
    setDeletingLegId(legId)
    await deleteLeg(weekId, legId, leagueId)
    setDeletingLegId(null)
    router.refresh()
  }

  const handleUpdateResult = async (
    legId: string,
    result: 'win' | 'loss' | 'push'
  ) => {
    setUpdatingLegId(legId)
    await updateLegResult(leagueId, weekId, legId, result)
    setUpdatingLegId(null)
    router.refresh()
  }

  const showResults =
    parlayState === 'graded' || parlayState === 'won' || parlayState === 'lost'
  const wins = legs.filter((l) => l.result === 'win').length
  const losses = legs.filter((l) => l.result === 'loss').length
  const pushes = legs.filter((l) => l.result === 'push').length
  const pending = legs.filter((l) => l.result === null).length
  const isLive = parlayState === 'graded' && pending > 0

  // Top leg = highest odds (riskiest single pick).
  const topLeg = useMemo(() => {
    let top: WeekOverviewLeg | null = null
    let topOdds = -Infinity
    for (const leg of legs) {
      if (leg.odds > topOdds) {
        topOdds = leg.odds
        top = leg
      }
    }
    return top
  }, [legs])

  // Hero leg = the win with the highest odds (best bet that hit).
  const heroLeg = useMemo(() => {
    let hero: WeekOverviewLeg | null = null
    let heroOdds = -Infinity
    for (const leg of legs) {
      if (leg.result !== 'win') continue
      if (leg.odds > heroOdds) {
        heroOdds = leg.odds
        hero = leg
      }
    }
    return hero
  }, [legs])

  // Killer leg = first loss in submission order (the one that broke it).
  const killerLeg = useMemo(() => {
    return (
      [...legs]
        .filter((l) => l.result === 'loss')
        .sort((a, b) => (a.legNumber || 0) - (b.legNumber || 0))[0] ?? null
    )
  }, [legs])

  // Sort losses first if lost, so the broken leg(s) lead the list. Otherwise
  // submission order.
  const sortedLegs = [...legs].sort((a, b) => {
    if (parlayState === 'lost') {
      if (a.result === 'loss' && b.result !== 'loss') return -1
      if (a.result !== 'loss' && b.result === 'loss') return 1
    }
    return (a.legNumber || 0) - (b.legNumber || 0)
  })

  return (
    <SectionDock
      kicker="The Lay"
      title={titleFor(parlayState, parlayResult)}
      icon={iconFor(parlayState, parlayResult)}
      accent={accentFor(parlayState, parlayResult)}
      trailing={
        <TrailingSlot
          totalOdds={totalOdds}
          legsLocked={legs.length}
          isLive={isLive}
          parlayState={parlayState}
          parlayResult={parlayResult}
          wins={wins}
          losses={losses}
          pending={pending}
        />
      }
      expandedContent={
        <ExpandedPanel
          sortedLegs={sortedLegs}
          notSubmittedMembers={notSubmittedMembers}
          parlayState={parlayState}
          showResults={showResults}
          canManage={canManage}
          currentUserId={currentUserId}
          updatingLegId={updatingLegId}
          deletingLegId={deletingLegId}
          onUpdate={handleUpdateResult}
          onDelete={handleDelete}
        />
      }
    >
      <FeatureCards
        parlayState={parlayState}
        parlayResult={parlayResult}
        totalOdds={totalOdds}
        wins={wins}
        losses={losses}
        pushes={pushes}
        pending={pending}
        topLeg={topLeg}
        heroLeg={heroLeg}
        killerLeg={killerLeg}
        legCount={legs.length}
      />
    </SectionDock>
  )
}

// ─── Heading state ─────────────────────────────────────────────────────────

function titleFor(state: ParlayState, result: 'won' | 'lost' | null): string {
  if (result === 'won') return 'Cashed'
  if (result === 'lost') return 'Broken'
  if (state === 'graded') return 'Live'
  return 'Locked In'
}

function iconFor(state: ParlayState, result: 'won' | 'lost' | null) {
  if (result === 'won') return Trophy
  if (result === 'lost') return Skull
  if (state === 'graded') return Flame
  return Lock
}

function accentFor(
  state: ParlayState,
  result: 'won' | 'lost' | null
): 'blue' | 'pink' | 'green' {
  if (result === 'won') return 'blue'
  if (result === 'lost') return 'pink'
  if (state === 'graded') return 'blue'
  return 'blue'
}

// ─── Trailing slot ─────────────────────────────────────────────────────────

function TrailingSlot({
  totalOdds,
  legsLocked,
  isLive,
  parlayState,
  parlayResult,
  wins,
  losses,
  pending,
}: {
  totalOdds: string | null
  legsLocked: number
  isLive: boolean
  parlayState: ParlayState
  parlayResult: 'won' | 'lost' | null
  wins: number
  losses: number
  pending: number
}) {
  // Combined odds chip — always shown when we have it. Gold for won,
  // muted for lost, blue otherwise.
  const oddsClass =
    parlayResult === 'won'
      ? 'ring-neon-blue/40 text-neon-blue'
      : parlayResult === 'lost'
        ? 'ring-white/15 text-muted-foreground line-through'
        : 'ring-white/15 text-foreground/90'
  return (
    <div className="flex items-center gap-2">
      {totalOdds && (
        <span
          className={cn(
            'rounded-full bg-white/[0.04] ring-1 px-2.5 py-1 text-[11px] font-bold tabular-nums',
            oddsClass
          )}
        >
          {totalOdds}
        </span>
      )}
      {isLive && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] ring-1 ring-neon-pink/30 px-2 py-1">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-neon-pink opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-pink" />
          </span>
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-pink">
            Live
          </span>
        </div>
      )}
      {!isLive && parlayState === 'locked' && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/[0.04] ring-1 ring-white/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
          <Clock className="h-3 w-3" />
          Awaiting
        </span>
      )}
      {parlayResult === 'won' && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-neon-blue/10 ring-1 ring-neon-blue/40 px-2 py-0.5 text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue">
          <Trophy className="h-3 w-3" />
          {wins}/{legsLocked}
        </span>
      )}
      {parlayResult === 'lost' && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-destructive/10 ring-1 ring-destructive/40 px-2 py-0.5 text-[10px] font-bold tracking-[0.25em] uppercase text-destructive">
          <Skull className="h-3 w-3" />
          {losses} miss
        </span>
      )}
    </div>
  )
}

// ─── Feature cards (section body) ───────────────────────────────────────────

function FeatureCards({
  parlayState,
  parlayResult,
  totalOdds,
  wins,
  losses,
  pushes,
  pending,
  topLeg,
  heroLeg,
  killerLeg,
  legCount,
}: {
  parlayState: ParlayState
  parlayResult: 'won' | 'lost' | null
  totalOdds: string | null
  wins: number
  losses: number
  pushes: number
  pending: number
  topLeg: WeekOverviewLeg | null
  heroLeg: WeekOverviewLeg | null
  killerLeg: WeekOverviewLeg | null
  legCount: number
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
      {parlayResult === 'won' && (
        <>
          <CashedCard totalOdds={totalOdds} legCount={legCount} wins={wins} pushes={pushes} />
          <HeroLegCard leg={heroLeg} />
          <TallyCard wins={wins} losses={losses} pushes={pushes} pending={pending} legCount={legCount} kind="won" />
        </>
      )}
      {parlayResult === 'lost' && (
        <>
          <BrokenCard totalOdds={totalOdds} losses={losses} />
          <KillerLegCard leg={killerLeg} />
          <TallyCard wins={wins} losses={losses} pushes={pushes} pending={pending} legCount={legCount} kind="lost" />
        </>
      )}
      {parlayResult === null && parlayState === 'graded' && (
        <>
          <LiveScoreCard wins={wins} losses={losses} pending={pending} legCount={legCount} />
          <PayoutCard totalOdds={totalOdds} alive={losses === 0} />
          {losses > 0 ? <KillerLegCard leg={killerLeg} /> : <TopLegCard leg={topLeg} />}
        </>
      )}
      {parlayResult === null && parlayState === 'locked' && (
        <>
          <PayoutCard totalOdds={totalOdds} alive={true} />
          <TopLegCard leg={topLeg} />
          <CountdownCard legCount={legCount} />
        </>
      )}
    </div>
  )
}

// ─── Card primitives ───────────────────────────────────────────────────────

function CashedCard({
  totalOdds,
  legCount,
  wins,
  pushes,
}: {
  totalOdds: string | null
  legCount: number
  wins: number
  pushes: number
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-neon-blue/35 bg-gradient-to-br from-neon-blue/[0.10] via-neon-blue/[0.03] to-transparent px-4 py-3.5">
      <Trophy
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-neon-blue opacity-[0.08]"
      />
      <div className="relative flex items-center gap-1.5">
        <Trophy className="h-3.5 w-3.5 text-neon-blue" />
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-blue">
          Cashed
        </p>
      </div>
      <p
        className="relative mt-2 font-display text-4xl font-bold tabular-nums leading-none text-neon-blue"
        style={{ textShadow: '0 0 16px rgba(0,217,255,0.35)' }}
      >
        {totalOdds ?? '—'}
      </p>
      <p className="relative mt-1.5 text-[11px] text-muted-foreground">
        {wins} of {legCount} hit
        {pushes > 0 && ` · ${pushes} push`}
      </p>
    </div>
  )
}

function BrokenCard({
  totalOdds,
  losses,
}: {
  totalOdds: string | null
  losses: number
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-destructive/35 bg-gradient-to-br from-destructive/[0.10] via-destructive/[0.03] to-transparent px-4 py-3.5">
      <Skull
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-destructive opacity-[0.08]"
      />
      <div className="relative flex items-center gap-1.5">
        <Skull className="h-3.5 w-3.5 text-destructive" />
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-destructive">
          Missed
        </p>
      </div>
      <p className="relative mt-2 font-display text-4xl font-bold tabular-nums leading-none text-destructive line-through opacity-80">
        {totalOdds ?? '—'}
      </p>
      <p className="relative mt-1.5 text-[11px] text-muted-foreground">
        Broken by {losses} {losses === 1 ? 'leg' : 'legs'}
      </p>
    </div>
  )
}

function HeroLegCard({ leg }: { leg: WeekOverviewLeg | null }) {
  if (!leg) {
    return (
      <EmptyShell label="Hero Leg" icon={Crosshair} hint="No wins yet" />
    )
  }
  return (
    <LegHighlightCard
      label="Hero Leg"
      hint="Biggest cash"
      leg={leg}
      tone="neon-blue"
    />
  )
}

function KillerLegCard({ leg }: { leg: WeekOverviewLeg | null }) {
  if (!leg) {
    return (
      <EmptyShell label="Killer Leg" icon={Crosshair} hint="No losses yet" />
    )
  }
  return (
    <LegHighlightCard
      label="Killer Leg"
      hint="Broke the run"
      leg={leg}
      tone="destructive"
    />
  )
}

function TopLegCard({ leg }: { leg: WeekOverviewLeg | null }) {
  if (!leg) {
    return <EmptyShell label="Longest Shot" icon={Crosshair} hint="No legs yet" />
  }
  return (
    <LegHighlightCard
      label="Longest Shot"
      hint="Highest odds in the lay"
      leg={leg}
      tone="pink"
    />
  )
}

function LegHighlightCard({
  label,
  hint,
  leg,
  tone,
}: {
  label: string
  hint: string
  leg: WeekOverviewLeg
  tone: 'neon-blue' | 'destructive' | 'pink'
}) {
  const toneClasses = {
    'neon-blue': {
      border: 'border-neon-blue/25',
      bgGrad: 'from-neon-blue/[0.07] via-transparent to-transparent',
      text: 'text-neon-blue',
    },
    destructive: {
      border: 'border-destructive/25',
      bgGrad: 'from-destructive/[0.07] via-transparent to-transparent',
      text: 'text-destructive',
    },
    pink: {
      border: 'border-neon-pink/25',
      bgGrad: 'from-neon-pink/[0.07] via-transparent to-transparent',
      text: 'text-neon-pink',
    },
  }[tone]

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-gradient-to-br px-4 py-3.5',
        toneClasses.border,
        toneClasses.bgGrad
      )}
    >
      <div className="flex items-center gap-1.5">
        <Crosshair className={cn('h-3.5 w-3.5', toneClasses.text)} />
        <p className={cn('text-[10px] font-bold tracking-[0.28em] uppercase', toneClasses.text)}>
          {label}
        </p>
      </div>
      <p
        className={cn(
          'mt-2 font-display text-3xl font-bold tabular-nums leading-none',
          toneClasses.text
        )}
      >
        {formatOdds(leg.odds)}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Avatar className="h-4 w-4">
          <AvatarImage
            src={leg.user.avatarUrl ?? undefined}
            alt={leg.user.fullName ?? leg.user.email}
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-[7px] font-bold">
            {getInitials(leg.user.fullName, leg.user.email)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{leg.user.fullName ?? leg.user.email}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/80 line-clamp-1 italic">
        {leg.description || hint}
      </p>
    </div>
  )
}

function TallyCard({
  wins,
  losses,
  pushes,
  pending,
  legCount,
  kind,
}: {
  wins: number
  losses: number
  pushes: number
  pending: number
  legCount: number
  kind: 'won' | 'lost'
}) {
  void pending
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground/80">
        Tally
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <Stat tone="text-neon-blue" value={wins} label="W" />
        <span className="text-muted-foreground/40 font-display text-xl">·</span>
        <Stat tone="text-destructive" value={losses} label="L" />
        {pushes > 0 && (
          <>
            <span className="text-muted-foreground/40 font-display text-xl">·</span>
            <Stat tone="text-foreground/70" value={pushes} label="P" />
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {kind === 'won'
          ? `Out of ${legCount} legs locked in`
          : `${legCount} legs, ${losses} broke it`}
      </p>
    </div>
  )
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={cn('font-display text-3xl font-bold tabular-nums leading-none', tone)}>
        {value}
      </span>
      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
        {label}
      </span>
    </span>
  )
}

function LiveScoreCard({
  wins,
  losses,
  pending,
  legCount,
}: {
  wins: number
  losses: number
  pending: number
  legCount: number
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/[0.07] via-transparent to-transparent px-4 py-3.5">
      <Flame
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-neon-pink opacity-[0.08]"
      />
      <div className="relative flex items-center gap-1.5">
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative inline-flex h-2 w-2"
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-neon-pink opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-pink" />
        </motion.span>
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
          Live
        </p>
      </div>
      <div className="relative mt-2 flex items-baseline gap-3">
        <Stat tone="text-neon-blue" value={wins} label="W" />
        <span className="text-muted-foreground/40 font-display text-xl">·</span>
        <Stat tone="text-destructive" value={losses} label="L" />
      </div>
      <p className="relative mt-1.5 text-[11px] text-muted-foreground">
        {pending} of {legCount} still in flight
      </p>
    </div>
  )
}

function PayoutCard({
  totalOdds,
  alive,
}: {
  totalOdds: string | null
  alive: boolean
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border px-4 py-3.5',
        alive
          ? 'border-neon-blue/25 bg-gradient-to-br from-neon-blue/[0.08] via-neon-blue/[0.02] to-transparent'
          : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <Trophy
        aria-hidden
        className={cn(
          'pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.08]',
          alive ? 'text-neon-blue' : 'text-muted-foreground'
        )}
      />
      <div className="relative flex items-center gap-1.5">
        <Trophy className={cn('h-3.5 w-3.5', alive ? 'text-neon-blue' : 'text-muted-foreground')} />
        <p
          className={cn(
            'text-[10px] font-bold tracking-[0.28em] uppercase',
            alive ? 'text-neon-blue' : 'text-muted-foreground'
          )}
        >
          {alive ? 'Payout' : 'Was'}
        </p>
      </div>
      <p
        className={cn(
          'relative mt-2 font-display text-4xl font-bold tabular-nums leading-none',
          alive ? 'text-neon-blue' : 'text-muted-foreground line-through'
        )}
        style={alive ? { textShadow: '0 0 16px rgba(255,215,0,0.35)' } : undefined}
      >
        {totalOdds ?? '—'}
      </p>
      <p className="relative mt-1.5 text-[11px] text-muted-foreground">
        {alive ? 'If everything cashes' : 'Could have been'}
      </p>
    </div>
  )
}

function CountdownCard({ legCount }: { legCount: number }) {
  // Pre-kickoff placeholder card. Phase C will wire this to the real
  // kickoff timestamp for the week and tick down in real time.
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
      <Lock
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-white/[0.06]"
      />
      <div className="relative flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-neon-blue" />
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-blue">
          Locked
        </p>
      </div>
      <p className="relative mt-2 font-display text-3xl font-bold tabular-nums leading-none text-foreground">
        {legCount}
      </p>
      <p className="relative mt-1.5 text-[11px] text-muted-foreground">
        legs in the lay · awaiting kickoff
      </p>
    </div>
  )
}

function EmptyShell({
  label,
  icon: Icon,
  hint,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint: string
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3.5">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground/70">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground italic">{hint}</span>
      </div>
    </div>
  )
}

// ─── Expanded panel — full leg list with admin grading ─────────────────────

function ExpandedPanel({
  sortedLegs,
  notSubmittedMembers,
  parlayState,
  showResults,
  canManage,
  currentUserId,
  updatingLegId,
  deletingLegId,
  onUpdate,
  onDelete,
}: {
  sortedLegs: WeekOverviewLeg[]
  notSubmittedMembers: WeekOverviewMember[]
  parlayState: ParlayState
  showResults: boolean
  canManage: boolean
  currentUserId: string
  updatingLegId: string | null
  deletingLegId: string | null
  onUpdate: (legId: string, result: 'win' | 'loss' | 'push') => void
  onDelete: (legId: string) => void
}) {
  return (
    <div className="px-4 py-4 space-y-3">
      {sortedLegs.map((leg) => {
        const palette = resultPalette(leg.result)
        const isMine = leg.user.id === currentUserId
        const showResultBadge = showResults
        const showAdminControls = canManage && showResults
        return (
          <div
            key={leg.id}
            className={cn(
              'relative p-3 rounded-lg border transition-all bg-white/[0.02]',
              showResults ? palette.cardClass : 'border-white/10'
            )}
          >
            {showResultBadge && (
              <div className="absolute top-2.5 right-2.5">
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', palette.text, palette.border)}
                >
                  {palette.label}
                </Badge>
              </div>
            )}

            <div className="flex items-center gap-2 pr-20">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={leg.user.avatarUrl ?? undefined}
                  alt={leg.user.fullName ?? leg.user.email}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                  {getInitials(leg.user.fullName, leg.user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate">
                {leg.user.fullName ?? leg.user.email}
              </span>
              {isMine && (
                <Badge variant="outline" className="text-[10px] border-primary/30 px-1.5 py-0">
                  You
                </Badge>
              )}
            </div>

            <div className="mt-1.5 pl-9">
              <p
                className={cn(
                  'text-sm break-words',
                  showResults ? palette.text : 'text-foreground/90'
                )}
              >
                {leg.description}
              </p>
              <Badge variant="outline" className="mt-1 text-[10px]">
                {formatOdds(leg.odds)}
              </Badge>
            </div>

            {showAdminControls && (
              <div className="mt-2 pl-9 flex items-center gap-1">
                <Button
                  size="icon"
                  onClick={() => onUpdate(leg.id, 'win')}
                  disabled={updatingLegId === leg.id}
                  className={cn(
                    'h-7 w-7 rounded',
                    leg.result === 'win'
                      ? 'bg-neon-blue text-black hover:bg-neon-blue'
                      : 'bg-transparent text-neon-blue hover:bg-neon-blue/10 border-[0.5px] border-neon-blue'
                  )}
                  title="Win"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </Button>
                <Button
                  size="icon"
                  onClick={() => onUpdate(leg.id, 'loss')}
                  disabled={updatingLegId === leg.id}
                  className={cn(
                    'h-7 w-7 rounded',
                    leg.result === 'loss'
                      ? 'bg-destructive text-black hover:bg-destructive'
                      : 'bg-transparent text-destructive hover:bg-destructive/10 border-[0.5px] border-destructive'
                  )}
                  title="Loss"
                >
                  <X className="h-3.5 w-3.5 stroke-[3]" />
                </Button>
                <Button
                  size="icon"
                  onClick={() => onUpdate(leg.id, 'push')}
                  disabled={updatingLegId === leg.id}
                  className={cn(
                    'h-7 w-7 rounded',
                    leg.result === 'push'
                      ? 'bg-gray-300 text-black hover:bg-gray-300'
                      : 'bg-transparent text-gray-300 hover:bg-white/10 border-[0.5px] border-gray-400'
                  )}
                  title="Push"
                >
                  <Minus className="h-3.5 w-3.5 stroke-[3]" />
                </Button>
              </div>
            )}

            {parlayState === 'locked' && canManage && (
              <div className="absolute bottom-2.5 right-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive/70 hover:text-destructive"
                  onClick={() => onDelete(leg.id)}
                  disabled={deletingLegId === leg.id}
                  title="Delete leg"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {sortedLegs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No legs in this parlay.
        </p>
      )}

      {notSubmittedMembers.length > 0 &&
        parlayState !== 'won' &&
        parlayState !== 'lost' && (
          <div className="rounded-lg p-3 border border-neon-pink/30 bg-neon-pink/[0.04]">
            <p className="text-sm font-medium text-neon-pink mb-1 inline-flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Waiting on {notSubmittedMembers.length} member
              {notSubmittedMembers.length === 1 ? '' : 's'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {notSubmittedMembers.map((m) => m.fullName ?? m.email).join(', ')}
            </p>
          </div>
        )}
    </div>
  )
}
