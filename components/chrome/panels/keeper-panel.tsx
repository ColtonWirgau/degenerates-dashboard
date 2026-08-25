'use client'

/**
 * THE KEEPER — declaring one, changing it, taking it back.
 *
 * It lived on the card, which made a record double as a form: the board
 * is what the league is holding, and something you can type into isn't a
 * record, it's a draft. Every other verb in this app opens off the action
 * pod into a sheet, and this is one.
 *
 * The player is PICKED, not typed. A free-text keeper is one nobody can
 * look up — no headshot, no position, and "Bijan" and "Bijan Robinson"
 * are two different players as far as the app is concerned. The catalogue
 * is Sleeper's, synced into a table; picking from it fills the position
 * and the face for free. Typing a name it doesn't have still works, for
 * the league that carries somebody Sleeper never heard of.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlayerFace } from '@/components/charter/player-face'
import { declareKeeper, findPlayers, withdrawKeeper } from '@/app/actions/keepers'
import type { PlayerHit } from '@/lib/nfl-players'
import type {
  KeeperBoardPerson,
  KeeperBoardRow,
} from '@/components/charter/keeper-board'
import { cn } from '@/lib/utils'

export function KeeperPanel({
  leagueId,
  season,
  people,
  keepers,
  currentUserId,
  canManage,
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
  // Whose keeper is being set. Yours to begin with, always — the sheet
  // opens on the thing you're most likely here to do.
  const [target, setTarget] = useState(currentUserId)

  const person = people.find((p) => p.userId === target)
  const existing = keepers.find((k) => k.userId === target) ?? null
  const mine = target === currentUserId
  // The draft binds your own hands, never the commissioner's — draft
  // night is exactly when a wrong keeper gets noticed.
  const shut = draftPassed && !canManage

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        The keeper
      </p>

      {canManage && (
        // WHOSE. Only for the people who run the league; for everyone
        // else there is one answer and a picker offering it would be a
        // control with a single option.
        <div className="scrollbar-hide -mx-1 mb-4 flex shrink-0 snap-x gap-1.5 overflow-x-auto px-1 pb-1">
          {people.map((p) => {
            const on = p.userId === target
            const has = keepers.some((k) => k.userId === p.userId)
            return (
              <button
                key={p.userId}
                type="button"
                onClick={() => setTarget(p.userId)}
                aria-label={`Set ${p.fullName ?? p.email}'s keeper`}
                aria-pressed={on}
                className={cn(
                  'flex w-[3.6rem] flex-none snap-start flex-col items-center gap-1 rounded-lg border px-1 pt-2 pb-1.5 transition-colors',
                  on
                    ? 'border-neon-blue/50 bg-neon-blue/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                )}
              >
                <Avatar className="h-7 w-7 ring-1 ring-white/10">
                  <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/70 text-primary-foreground text-[8px] font-bold">
                    {initials(p.fullName, p.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-[0.6rem] leading-none">
                  {firstName(p.fullName, p.email)}
                </span>
                <span
                  className={cn(
                    'h-1 w-1 rounded-full',
                    has ? 'bg-neon-blue/70' : 'bg-white/15'
                  )}
                />
              </button>
            )
          })}
        </div>
      )}

      <h2 className="font-display text-foreground mb-3 shrink-0 text-2xl leading-none tracking-tight uppercase">
        {mine ? 'Your keeper' : `${firstName(person?.fullName ?? null, person?.email ?? '')}'s keeper`}
      </h2>

      {shut ? (
        <p className="text-muted-foreground px-1 py-2 text-xs italic">
          The draft has started — keepers are set.
        </p>
      ) : (
        <KeeperForm
          key={target}
          leagueId={leagueId}
          season={season}
          userId={mine ? null : target}
          existing={existing}
        />
      )}
    </div>
  )
}

function KeeperForm({
  leagueId,
  season,
  userId,
  existing,
}: {
  leagueId: string
  season: string
  userId: string | null
  existing: KeeperBoardRow | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dropping, drop] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState(existing?.playerName ?? '')
  const [picked, setPicked] = useState<PlayerHit | null>(
    existing?.sleeperId
      ? {
          sleeperId: existing.sleeperId,
          fullName: existing.playerName,
          position: existing.position ?? '',
          team: null,
        }
      : null
  )
  const [hits, setHits] = useState<PlayerHit[]>([])
  const [searching, setSearching] = useState(false)
  const [round, setRound] = useState(
    existing?.roundCost != null ? String(existing.roundCost) : ''
  )
  const [year, setYear] = useState(String(existing?.yearOfKeep ?? 1))

  // Debounced lookup. Every keystroke hitting the database would be a
  // query per letter for a list nobody reads until they stop typing.
  const seq = useRef(0)
  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setHits([])
      return
    }
    const mine = ++seq.current
    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await findPlayers(leagueId, query)
      // A slower earlier request must not overwrite a faster later one.
      if (seq.current !== mine) return
      setHits(found)
      setSearching(false)
    }, 180)
    return () => clearTimeout(timer)
  }, [query, picked, leagueId])

  const save = () =>
    start(async () => {
      setError(null)
      const res = await declareKeeper({
        leagueId,
        season,
        playerName: picked?.fullName ?? query,
        position: picked?.position ?? existing?.position ?? '',
        roundCost: round,
        yearOfKeep: year,
        sleeperId: picked?.sleeperId ?? null,
        replacingId: existing?.id ?? null,
        userId,
      })
      if (!res.success) {
        setError(res.error)
        return
      }
      router.refresh()
    })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="space-y-3"
    >
      <div className="relative">
        <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-[0.22em] uppercase">
          Player
        </label>

        {picked ? (
          // Once it's a real player, show it AS one — the face is the
          // confirmation that the right Josh Allen got picked.
          <div className="border-neon-blue/30 bg-neon-blue/[0.06] flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
            <PlayerFace
              sleeperId={picked.sleeperId}
              name={picked.fullName}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <p className="text-foreground/90 truncate text-sm font-semibold">
                {picked.fullName}
              </p>
              <p className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.14em] uppercase">
                {[picked.position, picked.team].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPicked(null)
                setQuery('')
              }}
              aria-label="Pick a different player"
              className="text-muted-foreground/60 hover:text-foreground shrink-0 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="text-muted-foreground/40 pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the NFL"
                className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pr-3 pl-8 text-sm outline-none transition-colors"
              />
              {searching && (
                <Loader2 className="text-muted-foreground/50 absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin" />
              )}
            </div>

            {hits.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {hits.map((h) => (
                  <li key={h.sleeperId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(h)
                        setQuery(h.fullName)
                        setHits([])
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <PlayerFace
                        sleeperId={h.sleeperId}
                        name={h.fullName}
                        className="h-7 w-7"
                      />
                      <span className="text-foreground/90 min-w-0 flex-1 truncate text-[13px]">
                        {h.fullName}
                      </span>
                      <span className="text-muted-foreground/60 shrink-0 text-[10px] font-bold tracking-[0.12em] uppercase">
                        {[h.position, h.team].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Small label="Round cost" value={round} onChange={setRound} placeholder="4" />
        <Small label="Year of keep" value={year} onChange={setYear} placeholder="1" />
      </div>

      {error && <p className="text-destructive text-[11px]">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="submit"
          disabled={pending || (!picked && query.trim().length === 0)}
          className="bg-neon-blue/15 text-neon-blue border-neon-blue/40 hover:bg-neon-blue/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors disabled:opacity-40"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {existing ? 'Save' : 'Declare'}
        </button>

        {existing && (
          <button
            type="button"
            disabled={dropping}
            onClick={() =>
              drop(async () => {
                await withdrawKeeper({ leagueId, season, keeperId: existing.id })
                router.refresh()
              })
            }
            className="text-muted-foreground/70 hover:text-destructive inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors disabled:opacity-50"
          >
            {dropping ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Withdraw
          </button>
        )}
      </div>
    </form>
  )
}

function Small({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-[0.22em] uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm tabular-nums outline-none transition-colors"
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
