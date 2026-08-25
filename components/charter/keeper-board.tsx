'use client'

/**
 * WHO'S KEEPING WHOM — the declarations, and yours to make.
 *
 * The charter's `eligible-keepers` row said "12 rosters · tap to view"
 * and pointed at a table that had never been written: the roster shape
 * lived only in the mock generator, so on real data the condition that
 * rendered it was always false. Twelve rosters, none of them anywhere.
 *
 * Keepers are RECORDS, not decisions — one per person per season,
 * declared by them, amended until the draft — so they're rows in their
 * own table now, and this is where they're made. The RULES stay in the
 * charter above, because those are voted on.
 *
 * Your own row sits first and is the only one you can touch. A keeper
 * somebody else declared for you isn't a keeper, it's a mistake with
 * your name on it.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { declareKeeper, withdrawKeeper } from '@/app/actions/keepers'
import { cn } from '@/lib/utils'

export interface KeeperBoardPerson {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

export interface KeeperBoardRow {
  id: string
  userId: string
  playerName: string
  position: string | null
  roundCost: number | null
  yearOfKeep: number
}

export function KeeperBoard({
  leagueId,
  season,
  people,
  keepers,
  currentUserId,
  canManage,
  /** Null when the league hasn't settled a draft date — nothing to be
   *  late for, so nothing is closed. */
  draftPassed,
}: {
  leagueId: string
  season: string
  people: KeeperBoardPerson[]
  keepers: KeeperBoardRow[]
  currentUserId: string
  canManage: boolean
  draftPassed: boolean
}) {
  const [editing, setEditing] = useState(false)

  const mine = keepers.filter((k) => k.userId === currentUserId)
  const byUser = new Map<string, KeeperBoardRow[]>()
  for (const k of keepers) {
    byUser.set(k.userId, [...(byUser.get(k.userId) ?? []), k])
  }

  // You first, then everyone who's declared, then everyone who hasn't.
  // A board where the empties are scattered through it reads as noise;
  // grouped, it reads as "these people still owe you an answer".
  const others = people.filter((p) => p.userId !== currentUserId)
  const ordered = [
    ...others.filter((p) => (byUser.get(p.userId)?.length ?? 0) > 0),
    ...others.filter((p) => (byUser.get(p.userId)?.length ?? 0) === 0),
  ]
  const me = people.find((p) => p.userId === currentUserId)

  return (
    <div id="keeper-board" className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-muted-foreground/60 text-[9px] font-bold tracking-[0.3em] uppercase">
          Declared keepers
        </p>
        <p className="text-muted-foreground/50 text-[10px] tabular-nums">
          {byUser.size}/{people.length} in
        </p>
      </div>

      {/* YOURS — the only row that's a control. */}
      {me &&
        (editing ? (
          <KeeperForm
            leagueId={leagueId}
            season={season}
            existing={mine[0] ?? null}
            onDone={() => setEditing(false)}
          />
        ) : (
          <div className="border-neon-blue/25 bg-neon-blue/[0.06] mb-2 rounded-lg border px-3 py-2.5">
            {mine.length === 0 ? (
              <button
                type="button"
                disabled={draftPassed}
                onClick={() => setEditing(true)}
                className="text-neon-blue hover:text-neon-blue/80 flex w-full items-center gap-2 text-left text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {draftPassed
                  ? 'Keepers are set — the draft has started'
                  : 'Declare your keeper'}
              </button>
            ) : (
              <div className="space-y-1.5">
                {mine.map((k) => (
                  <div key={k.id} className="flex items-center gap-2">
                    <KeeperLine keeper={k} />
                    {!draftPassed && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          aria-label={`Change your keeper — ${k.playerName}`}
                          className="text-muted-foreground/60 hover:text-neon-blue shrink-0 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <WithdrawButton
                          leagueId={leagueId}
                          season={season}
                          keeper={k}
                          label={`Withdraw your keeper — ${k.playerName}`}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

      <div className="space-y-1">
        {ordered.map((p) => {
          const theirs = byUser.get(p.userId) ?? []
          return (
            <div key={p.userId} className="flex items-center gap-2.5 px-1 py-1">
              <Avatar className="h-6 w-6 shrink-0 ring-1 ring-white/10">
                <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-primary/70 text-primary-foreground text-[8px] font-bold">
                  {initials(p.fullName, p.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground/80 w-20 shrink-0 truncate text-[13px]">
                {firstName(p.fullName, p.email)}
              </span>
              {theirs.length === 0 ? (
                <span className="text-muted-foreground/40 text-[13px] italic">
                  not in yet
                </span>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {theirs.map((k) => (
                    <div key={k.id} className="flex items-center gap-2">
                      <KeeperLine keeper={k} />
                      {canManage && !draftPassed && (
                        <WithdrawButton
                          leagueId={leagueId}
                          season={season}
                          keeper={k}
                          label={`Withdraw ${firstName(p.fullName, p.email)}'s keeper — ${k.playerName}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Player, position, and what it costs — the three facts, in that order. */
function KeeperLine({ keeper }: { keeper: KeeperBoardRow }) {
  return (
    <p className="flex min-w-0 flex-1 items-baseline gap-2 text-[13px]">
      <span className="text-foreground/90 min-w-0 truncate font-medium">
        {keeper.playerName}
      </span>
      {keeper.position && (
        <span className="text-muted-foreground/60 shrink-0 text-[10px] font-bold tracking-[0.14em] uppercase">
          {keeper.position}
        </span>
      )}
      <span className="text-muted-foreground/70 ml-auto shrink-0 text-[11px] tabular-nums">
        {keeper.roundCost != null ? `R${keeper.roundCost}` : '—'}
        {keeper.yearOfKeep > 1 && ` · yr ${keeper.yearOfKeep}`}
      </span>
    </p>
  )
}

function WithdrawButton({
  leagueId,
  season,
  keeper,
  label,
}: {
  leagueId: string
  season: string
  keeper: KeeperBoardRow
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
          await withdrawKeeper({ leagueId, season, keeperId: keeper.id })
          router.refresh()
        })
      }
      className="text-muted-foreground/50 hover:text-destructive shrink-0 transition-colors disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
    </button>
  )
}

function KeeperForm({
  leagueId,
  season,
  existing,
  onDone,
}: {
  leagueId: string
  season: string
  existing: KeeperBoardRow | null
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState(existing?.playerName ?? '')
  const [position, setPosition] = useState(existing?.position ?? '')
  const [roundCost, setRoundCost] = useState(
    existing?.roundCost != null ? String(existing.roundCost) : ''
  )
  const [yearOfKeep, setYearOfKeep] = useState(String(existing?.yearOfKeep ?? 1))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const res = await declareKeeper({
            leagueId,
            season,
            playerName,
            position,
            roundCost,
            yearOfKeep,
            replacingId: existing?.id ?? null,
          })
          if (!res.success) {
            setError(res.error)
            return
          }
          router.refresh()
          onDone()
        })
      }}
      className="border-neon-blue/25 bg-neon-blue/[0.06] mb-2 space-y-2 rounded-lg border px-3 py-3"
    >
      <input
        autoFocus
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Player"
        className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none transition-colors"
      />
      <div className="grid grid-cols-3 gap-2">
        <Small value={position} onChange={setPosition} placeholder="RB" label="Pos" />
        <Small value={roundCost} onChange={setRoundCost} placeholder="4" label="Round" />
        <Small value={yearOfKeep} onChange={setYearOfKeep} placeholder="1" label="Year" />
      </div>

      {error && <p className="text-destructive text-[11px]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            'bg-neon-blue/15 text-neon-blue border-neon-blue/40 hover:bg-neon-blue/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
            'text-[10px] font-bold tracking-[0.2em] uppercase transition-colors disabled:opacity-50'
          )}
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {existing ? 'Save' : 'Declare'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-muted-foreground hover:text-foreground px-2 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function Small({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground/60 mb-1 block text-[9px] font-bold tracking-[0.2em] uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm outline-none transition-colors"
      />
    </label>
  )
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function firstName(name: string | null, email: string): string {
  return name?.split(' ')[0] ?? email.split('@')[0] ?? email
}
