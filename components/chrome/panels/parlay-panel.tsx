'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Minus, Pencil, Skull, Trophy, X } from 'lucide-react'
import {
  useLeagueChrome,
  useViewedWeek,
} from '@/components/chrome/league-chrome-context'
import { markWeekDirty } from '@/components/chrome/canvas-store'
import { deleteLeg, setLegForMember } from '@/app/actions/legs'
import { cn } from '@/lib/utils'

export interface ParlayPanelLeg {
  id: string
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
}

export interface ParlayPanelWeek {
  legs: ParlayPanelLeg[]
  missing: Array<{
    userId: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }>
  totalOdds: string | null
}

/**
 * THE LAY — one row per person, always. Everyone in the league appears,
 * whether they've picked or not: a missing leg is a fact about that
 * person, not a separate category of thing, so there's no "still owing"
 * section pulling the roster apart.
 *
 * The order is how far along you are — settled first, then in but
 * pending, then the people who still owe one. So the top of the list is
 * what happened and the bottom is who we're waiting on.
 *
 * For whoever runs the league, every row is also a control while the
 * week is open. People text their pick in when they're driving, and
 * somebody always fat-fingers the odds — the alternative to entering it
 * for them is a database client.
 */
export function ParlayPanel({
  weeks,
}: {
  /** Every week's lay, keyed by week id. */
  weeks: Record<string, ParlayPanelWeek>
}) {
  const week = useViewedWeek()
  const chrome = useLeagueChrome()
  const lay = week ? weeks[week.id] : undefined
  // Whose row is being typed into.
  const [editing, setEditing] = useState<string | null>(null)

  if (!week || !lay) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-xs italic">
        No parlay for this week.
      </p>
    )
  }

  // Settled → in but pending → still owing. Within a tier, keep the
  // order the server gave (leg order, then roster order).
  const rows: Row[] = [
    ...lay.legs
      .filter((l) => l.result !== null)
      .map((leg) => ({ kind: 'leg' as const, leg })),
    ...lay.legs
      .filter((l) => l.result === null)
      .map((leg) => ({ kind: 'leg' as const, leg })),
    ...lay.missing.map((person) => ({ kind: 'empty' as const, person })),
  ]

  const hit = lay.legs.filter((l) => l.result === 'win').length
  const graded = lay.legs.filter((l) => l.result !== null).length

  const won = week.parlayState === 'won'
  const lost = week.parlayState === 'lost'
  // Only while the week can still take entries. A settled week is a
  // record, and a record you can edit isn't one.
  const editable =
    (chrome?.canManage ?? false) && week.parlayState === 'open' && !week.closed

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Same masthead as everywhere else the app names a week: the
          the panel's NOUN on its tinted slab — the week's number was
          on it, which the hero beside it already says in 60px type, and
          which left the panel's own name floating in body text. Now the
          slab says what this is and the far end says how it's going.

          The slab reaches the panel's corner the way the page header
          reaches the card's — negative margins cancelling the panel's
          own px-5/pt-5, so it sits ON the corner rather than floating
          inside it. The panel clips to its 20px radius, so the corner
          comes out rounded without asking. */}
      <div className="mb-3 flex shrink-0 items-stretch gap-2.5">
        <div
          className="relative -mt-5 -ml-5 flex shrink-0 items-center overflow-hidden rounded-tl-[20px] pt-5 pr-5 pb-1.5 pl-5"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%)',
            background: won
              ? 'linear-gradient(150deg, rgba(0,217,255,0.22), rgba(0,217,255,0.04))'
              : lost
                ? 'linear-gradient(150deg, rgba(255,105,180,0.22), rgba(255,105,180,0.04))'
                : 'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          }}
        >
          <h2
            className={cn(
              'font-display text-lg leading-none tracking-tight uppercase',
              won ? 'text-neon-blue' : lost ? 'text-destructive' : 'text-foreground/80'
            )}
          >
            The Lay
          </h2>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end">
          {/* The number is the reason you opened this, so it's set like
              one — the same weight the slab carries, at the far end.
              It spent a while as 11px of muted grey beside a heading
              that repeated the panel's own name. */}
          <p
            className={cn(
              'font-display shrink-0 text-[1.75rem] leading-none tabular-nums',
              graded > 0 && hit === graded
                ? 'text-neon-blue'
                : won
                  ? 'text-neon-blue'
                  : lost
                    ? 'text-destructive'
                    : 'text-foreground/70'
            )}
          >
            {graded > 0 ? `${hit}/${graded}` : lay.totalOdds}
          </p>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {rows.map((row) => {
          const userId = row.kind === 'leg' ? row.leg.userId : row.person.userId
          if (editing === userId && chrome && week.parlayId) {
            return (
              <MemberLegForm
                key={userId}
                leagueId={chrome.leagueId}
                parlayId={week.parlayId}
                userId={userId}
                name={
                  row.kind === 'leg'
                    ? firstNameOf(row.leg.fullName, row.leg.email)
                    : firstNameOf(row.person.fullName, row.person.email)
                }
                existing={row.kind === 'leg' ? row.leg : null}
                onDone={() => setEditing(null)}
              />
            )
          }
          return row.kind === 'leg' ? (
            <LegRow
              key={row.leg.id}
              leg={row.leg}
              editable={editable}
              onEdit={() => setEditing(row.leg.userId)}
              leagueId={chrome?.leagueId ?? ''}
              parlayId={week.parlayId}
            />
          ) : (
            <EmptyRow
              key={row.person.userId}
              person={row.person}
              editable={editable}
              onEdit={() => setEditing(row.person.userId)}
            />
          )
        })}
        {rows.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            Nobody in this league yet.
          </p>
        )}
      </div>
    </div>
  )
}

type Row =
  | { kind: 'leg'; leg: ParlayPanelLeg }
  | { kind: 'empty'; person: ParlayPanelWeek['missing'][number] }

/** One person, one card — their name, their leg, and how it went. */
function LegRow({
  leg,
  editable,
  onEdit,
  leagueId,
  parlayId,
}: {
  leg: ParlayPanelLeg
  editable: boolean
  onEdit: () => void
  leagueId: string
  parlayId: string | null
}) {
  const settled = leg.result !== null
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        leg.result === 'win'
          ? 'border-neon-blue/30 bg-neon-blue/5'
          : leg.result === 'loss'
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-5 w-5 shrink-0 ring-1 ring-white/10">
          <AvatarImage src={leg.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/80 text-primary-foreground text-[8px] font-bold">
            {initialsOf(leg.fullName, leg.email)}
          </AvatarFallback>
        </Avatar>
        <span className="text-foreground/70 min-w-0 flex-1 truncate text-[11px] font-semibold">
          {firstNameOf(leg.fullName, leg.email)}
        </span>
        <span
          className={cn(
            'shrink-0 text-[11px] font-bold tabular-nums',
            leg.result === 'win'
              ? 'text-neon-blue'
              : leg.result === 'loss'
                ? 'text-destructive'
                : 'text-foreground/70'
          )}
        >
          {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
        </span>
        {settled && <ResultMark result={leg.result} />}
        {editable && parlayId && (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Change ${firstNameOf(leg.fullName, leg.email)}'s leg`}
              className="text-muted-foreground/50 hover:text-neon-blue shrink-0 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <DropLeg
              leagueId={leagueId}
              parlayId={parlayId}
              legId={leg.id}
              label={`Remove ${firstNameOf(leg.fullName, leg.email)}'s leg`}
            />
          </>
        )}
      </div>
      <p className="text-foreground/90 mt-1 pl-7 text-xs leading-snug break-words">
        {leg.description}
      </p>
    </div>
  )
}

/** Same card, nothing in it — the person is present, the pick isn't. */
function EmptyRow({
  person,
  editable,
  onEdit,
}: {
  person: ParlayPanelWeek['missing'][number]
  editable: boolean
  onEdit: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-2.5 py-2">
      <Avatar className="h-5 w-5 shrink-0 opacity-50 ring-1 ring-white/10">
        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-white/10 text-[8px] font-bold">
          {initialsOf(person.fullName, person.email)}
        </AvatarFallback>
      </Avatar>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] font-semibold">
        {firstNameOf(person.fullName, person.email)}
      </span>
      {editable ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Enter ${firstNameOf(person.fullName, person.email)}'s leg`}
          className="text-muted-foreground/60 hover:text-neon-blue shrink-0 text-[10px] italic transition-colors"
        >
          no pick — enter it
        </button>
      ) : (
        <span className="text-muted-foreground/60 shrink-0 text-[10px] italic">
          no pick
        </span>
      )}
    </div>
  )
}

/** Take somebody's leg back out. */
function DropLeg({
  leagueId,
  parlayId,
  legId,
  label,
}: {
  leagueId: string
  parlayId: string
  legId: string
  label: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      onClick={() =>
        start(async () => {
          await deleteLeg(parlayId, legId, leagueId)
          markWeekDirty()
          router.refresh()
        })
      }
      className="text-muted-foreground/50 hover:text-destructive shrink-0 transition-colors disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

/**
 * Somebody else's leg, typed by a commissioner.
 *
 * Delete-then-submit happens on the SERVER in one action: every leg is
 * stamped locked the moment it lands and `submitLeg` refuses to
 * overwrite a locked one, so an edit is always a replacement — and
 * doing both halves in one place means a failed submit can't leave
 * somebody with no leg at all.
 */
function MemberLegForm({
  leagueId,
  parlayId,
  userId,
  name,
  existing,
  onDone,
}: {
  leagueId: string
  parlayId: string
  userId: string
  name: string
  existing: ParlayPanelLeg | null
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState(existing?.description ?? '')
  const [odds, setOdds] = useState(existing ? String(existing.odds) : '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const res = await setLegForMember(parlayId, leagueId, userId, {
            description,
            odds,
          })
          if (!res.success) {
            setError(res.error ?? 'Could not save')
            return
          }
          markWeekDirty()
          router.refresh()
          onDone()
        })
      }}
      className="border-neon-blue/25 bg-neon-blue/[0.06] space-y-2 rounded-lg border px-2.5 py-2.5"
    >
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.2em] uppercase">
        {name}&apos;s leg
      </p>
      <input
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., Chiefs -3.5"
        className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs outline-none transition-colors"
      />
      <input
        value={odds}
        onChange={(e) => setOdds(e.target.value)}
        placeholder="-110"
        className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs tabular-nums outline-none transition-colors"
      />
      {error && <p className="text-destructive text-[10px]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-neon-blue/15 text-neon-blue border-neon-blue/40 hover:bg-neon-blue/25 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.2em] uppercase transition-colors disabled:opacity-50"
        >
          {pending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-muted-foreground hover:text-foreground px-1.5 py-1 text-[9px] font-bold tracking-[0.2em] uppercase transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ResultMark({ result }: { result: ParlayPanelLeg['result'] }) {
  // A trophy, never a tick: a tick means "submitted" in this app, and a
  // leg can be submitted and still lose.
  if (result === 'win')
    return <Trophy className="text-neon-blue h-3.5 w-3.5 shrink-0" />
  if (result === 'loss')
    return <Skull className="text-destructive h-3.5 w-3.5 shrink-0" />
  return <Minus className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
}

function initialsOf(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function firstNameOf(name: string | null, email: string): string {
  return name?.split(' ')[0] ?? email.split('@')[0] ?? email
}
