'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Loader2, Shield, UserMinus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  closePanel,
  openLeagueSheet,
  setStageView,
  setSwitchingSeason,
  setViewedWeek,
} from '@/components/chrome/canvas-store'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import { LeagueAvatar } from '@/components/league-avatar'
import { writeViewSeason } from '@/lib/view-season-cookie'
import { removeMember, updateMemberRole } from '@/app/actions/leagues'
import { SlateSettings } from '@/components/league-pages'
import { DevPhaseSwitcher } from '@/components/user-menu'
import type { DevPhaseData } from '@/lib/data/dev-toolbar-data'
import { cn } from '@/lib/utils'

export interface SeasonPanelMember {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'member'
  /** Their record in the season being shown. */
  wins: number
  losses: number
  pushes: number
}

/**
 * THE SEASON — which year the whole app is answering for, and who was in
 * it.
 *
 * Tapping a year switches to it, full stop: no preview-then-commit
 * two-step, because a list where tapping a row does something other than
 * the obvious thing is a list that feels broken.
 *
 * The roster sits right here rather than behind a door, borrowing
 * RoarTracker's people carousel: a row of faces you can push through,
 * each card carrying that person's record FOR THE SELECTED YEAR, and
 * tapping one opens the working side underneath it. Flipping the year
 * re-reads the whole section, which is the point — this is the one place
 * that answers "who was in it, and how did they do".
 *
 * The slate settings sit here too, for the same reason: they're three
 * rows of chips, the panel has the room, and a modal you have to open to
 * flick a toggle is a modal you'll forget exists.
 */
export function SeasonPanel({
  availableSeasons,
  members,
  currentUserId,
  currentUserRole,
  devPhase,
}: {
  availableSeasons: string[]
  members: SeasonPanelMember[]
  currentUserId: string
  currentUserRole: 'owner' | 'admin' | 'member'
  /** Neon-mode dev control — season-phase time travel. Null outside dev. */
  devPhase?: DevPhaseData | null
}) {
  const chrome = useLeagueChrome()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)

  // Belt and braces. The provider clears the switch when the new season's
  // data actually arrives; this catches the case where the refresh comes
  // back and it never does, so a failure leaves you on a real screen
  // instead of skeletons forever.
  useEffect(() => {
    if (!pending) setSwitchingSeason(null)
  }, [pending])

  if (!chrome) return null
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  const pick = (season: string) => {
    if (season === chrome.season) {
      closePanel()
      return
    }

    // Everything the browser can do, before anything the server has to.
    // The week you were on belongs to the season you're leaving, so it
    // goes first — otherwise the stage spends the switch pointing at a
    // week that's about to stop existing.
    setViewedWeek(null)
    setOpenId(null)
    // A season that isn't the one the calendar is on is a season that
    // finished, and the first thing you want from a finished season is
    // how it went — not week 1 of 18.
    setStageView(season === availableSeasons[0] ? 'week' : 'recap')
    // Picking the calendar's own season clears the pin rather than
    // freezing you on it.
    writeViewSeason(season === availableSeasons[0] ? null : season)
    // Announce it: the masthead and the tick below move on this, not on
    // the refresh. Then get out of the way so you can watch it happen.
    setSwitchingSeason(season)
    closePanel()

    start(() => {
      router.refresh()
    })
  }

  const selected = members.find((m) => m.userId === openId) ?? null

  return (
    <div className="scrollbar-hide flex min-h-0 flex-col overflow-y-auto">
      <p className="text-muted-foreground mb-2 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        Season
      </p>

      <div className="mb-5 shrink-0 space-y-1.5">
        {availableSeasons.map((s) => {
          const active = s === chrome.season
          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              disabled={pending}
              aria-current={active ? 'true' : undefined}
              // No pending dimming any more: `active` already reads the
              // season you just pressed, so the tick lands on this row on
              // the same frame as the click. Greying the list out on the
              // way would be the app admitting to a wait it isn't making
              // you do.
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                active
                  ? 'border-neon-blue/40 bg-neon-blue/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
              )}
            >
              <span
                className={cn(
                  'font-display text-lg leading-none',
                  active ? 'text-neon-blue' : 'text-foreground/80'
                )}
              >
                {s.split('-')[0]}
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase">
                {s}
              </span>
              {active && <Check className="text-neon-blue h-4 w-4 shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* The league, and who was in it that year. */}
      <div className="min-h-0 shrink border-t border-white/10 pt-4">
        <div className="mb-3 flex items-center gap-3">
          <LeagueAvatar leagueId={chrome.leagueId} size="sm" name={chrome.leagueName} />
          <div className="min-w-0 flex-1">
            <p className="text-foreground/90 truncate text-sm leading-tight font-bold">
              {chrome.leagueName}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {members.length} members
            </p>
          </div>
        </div>

        {/* The carousel — push through the faces; the trailing card adds
            the next one. */}
        <div className="scrollbar-hide -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
          {members.map((m) => {
            const on = openId === m.userId
            const played = m.wins + m.losses + m.pushes > 0
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => setOpenId(on ? null : m.userId)}
                aria-expanded={on}
                className={cn(
                  'flex w-[4.4rem] flex-none snap-start flex-col items-center gap-1.5 rounded-lg border px-1.5 pt-2.5 pb-2 transition-colors',
                  on
                    ? 'border-neon-blue/50 bg-neon-blue/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                )}
              >
                <Avatar className="h-8 w-8 ring-1 ring-white/10">
                  <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/70 text-primary-foreground text-[9px] font-bold">
                    {initialsOf(m.fullName, m.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-[0.65rem] leading-none">
                  {firstNameOf(m.fullName, m.email)}
                </span>
                <span
                  className={cn(
                    'text-[0.58rem] leading-none tabular-nums',
                    played ? 'text-foreground/70' : 'text-muted-foreground/50'
                  )}
                >
                  {played ? `${m.wins}–${m.losses}` : '—'}
                </span>
              </button>
            )
          })}
          {canManage && (
            <button
              type="button"
              onClick={() => openLeagueSheet('invite')}
              aria-label="Invite someone"
              className="text-muted-foreground hover:text-neon-blue hover:border-neon-blue/30 flex w-[4.4rem] flex-none snap-start flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-2 py-3 transition-colors"
            >
              <span className="font-display text-[1.4rem] leading-none">+</span>
            </button>
          )}
        </div>

        {selected && (
          <MemberDetail
            key={selected.userId}
            leagueId={chrome.leagueId}
            member={selected}
            isMe={selected.userId === currentUserId}
            viewerRole={currentUserRole}
            onGone={() => setOpenId(null)}
          />
        )}
      </div>

      {/* How the league runs — right here, not behind a gear. */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <SlateSettings canManage={canManage} leagueId={chrome.leagueId} />
      </div>

      {devPhase && (
        <div className="mt-2">
          <DevPhaseSwitcher data={devPhase} />
        </div>
      )}
    </div>
  )
}

/** The working side of one member: what they did this season, and — for
 *  the people who run the league — what you can do about them. */
function MemberDetail({
  leagueId,
  member,
  isMe,
  viewerRole,
  onGone,
}: {
  leagueId: string
  member: SeasonPanelMember
  isMe: boolean
  viewerRole: 'owner' | 'admin' | 'member'
  onGone: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const total = member.wins + member.losses + member.pushes
  const rate = total > 0 ? Math.round((member.wins / total) * 100) : null

  // Owners set roles; owners and admins remove, but never themselves and
  // never an owner. Mirrors the server's matrix so the UI can't offer
  // something the action will refuse.
  const canSetRole = viewerRole === 'owner' && member.role !== 'owner'
  const canRemove =
    !isMe &&
    member.role !== 'owner' &&
    (viewerRole === 'owner' || (viewerRole === 'admin' && member.role === 'member'))

  const run = (fn: () => Promise<{ error?: string | null }>) =>
    start(async () => {
      setError(null)
      const res = await fn()
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
    })

  return (
    <div className="mt-3 border-t border-dashed border-white/15 pt-3">
      <p className="text-foreground/90 flex items-center gap-1.5 text-sm font-semibold">
        {member.fullName ?? member.email}
        {isMe && <span className="text-neon-blue text-[11px] font-bold">· you</span>}
        {member.role !== 'member' && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] tracking-[0.15em] uppercase">
            {member.role === 'owner' ? (
              <Crown className="h-3 w-3" />
            ) : (
              <Shield className="h-3 w-3" />
            )}
            {member.role}
          </span>
        )}
      </p>
      <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{member.email}</p>

      <div className="mt-2.5 flex items-center gap-4 text-xs tabular-nums">
        <span className="text-neon-blue font-bold">{member.wins} hit</span>
        <span className="text-destructive font-bold">{member.losses} missed</span>
        {member.pushes > 0 && (
          <span className="text-muted-foreground">{member.pushes} push</span>
        )}
        {rate !== null && <span className="text-foreground/70 ml-auto">{rate}%</span>}
      </div>

      {(canSetRole || canRemove) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {canSetRole && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateMemberRole(
                    leagueId,
                    member.userId,
                    member.role === 'admin' ? 'member' : 'admin'
                  )
                )
              }
              className="text-muted-foreground hover:text-neon-blue hover:border-neon-blue/30 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            >
              {member.role === 'admin' ? 'Make member' : 'Make admin'}
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await removeMember(leagueId, member.userId)
                  if (!res.error) onGone()
                  return res
                })
              }
              className="text-destructive/80 hover:text-destructive border-destructive/20 hover:border-destructive/50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            >
              <UserMinus className="h-3 w-3" />
              Remove
            </button>
          )}
          {pending && (
            <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin self-center" />
          )}
        </div>
      )}

      {error && <p className="text-destructive mt-2 text-[11px]">{error}</p>}
    </div>
  )
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
