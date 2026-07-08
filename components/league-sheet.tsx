'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { LeagueAvatar } from '@/components/league-avatar'
import { Button } from '@/components/ui/button'
import { SeasonFormStrip } from '@/components/season-form-strip'
import { FinalStandings } from '@/components/final-standings'
import { regenerateInviteCode } from '@/app/actions/leagues'
import { getLeagueSeasonBundle } from '@/app/actions/league-season'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Crown,
  History,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  User as UserIcon,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type LeagueSheetMember = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'member'
}

interface LeagueSheetProps {
  open: boolean
  onClose: () => void
  leagueId: string
  leagueName: string
  memberCount: number
  /** Season currently displayed on the league page (default selection). */
  season: string
  inviteCode: string
  canManage: boolean
  weeks: WeekDetailData[]
  /** Index into `weeks` of the in-flight week (only for the active season). */
  currentWeekIndex: number
  members: LeagueSheetMember[]
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  availableSeasons: string[]
}

export function LeagueSheet(props: LeagueSheetProps) {
  // The strip's "current week" pulse only makes sense for the active season.
  // When the user flips to a prior season, drop the marker.
  const [selectedSeason, setSelectedSeason] = useState(props.season)
  const [weeks, setWeeks] = useState(props.weeks)
  const [leaderboard, setLeaderboard] = useState(props.leaderboard)
  const [pending, startTransition] = useTransition()

  // Reset on close so reopening always lands on the active season.
  useEffect(() => {
    if (!props.open) {
      setSelectedSeason(props.season)
      setWeeks(props.weeks)
      setLeaderboard(props.leaderboard)
    }
  }, [props.open, props.season, props.weeks, props.leaderboard])

  const isActiveSeason = selectedSeason === props.season
  const effectiveWeekIndex = isActiveSeason ? props.currentWeekIndex : -1

  const handlePickSeason = (s: string) => {
    if (s === selectedSeason) return
    setSelectedSeason(s)
    if (s === props.season) {
      // Snap back to the values the page already had — no fetch needed.
      setWeeks(props.weeks)
      setLeaderboard(props.leaderboard)
      return
    }
    startTransition(async () => {
      const res = await getLeagueSeasonBundle(props.leagueId, s)
      if (res.payload) {
        setWeeks(res.payload.weeks)
        setLeaderboard(res.payload.leaderboard)
      }
    })
  }

  return (
    <ResponsiveSheet
      open={props.open}
      onClose={props.onClose}
      panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
      sheetMaxHeight="92dvh"
    >
      <SheetPage name="main">
        <MainPage
          leagueId={props.leagueId}
          leagueName={props.leagueName}
          memberCount={props.memberCount}
          season={selectedSeason}
          availableSeasons={props.availableSeasons}
          onPickSeason={handlePickSeason}
          switching={pending}
          weeks={weeks}
          currentWeekIndex={effectiveWeekIndex}
          leaderboard={leaderboard}
          currentUserId={props.currentUserId}
          canManage={props.canManage}
        />
      </SheetPage>

      <SheetPage name="settings" title="Settings">
        <SettingsPage canManage={props.canManage} leagueId={props.leagueId} />
      </SheetPage>

      <SheetPage name="members" title="Members">
        <MembersPage members={props.members} currentUserId={props.currentUserId} />
      </SheetPage>

      <SheetPage name="invite" title="Invite">
        <InvitePage
          leagueId={props.leagueId}
          inviteCode={props.inviteCode}
          canRegenerate={props.canManage}
        />
      </SheetPage>

      <SheetPage name="history" title="History">
        <HistoryPage />
      </SheetPage>
    </ResponsiveSheet>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

function MainPage({
  leagueId,
  leagueName,
  memberCount,
  season,
  availableSeasons,
  onPickSeason,
  switching,
  weeks,
  currentWeekIndex,
  leaderboard,
  currentUserId,
  canManage,
}: {
  leagueId: string
  leagueName: string
  memberCount: number
  season: string
  availableSeasons: string[]
  onPickSeason: (season: string) => void
  switching: boolean
  weeks: WeekDetailData[]
  currentWeekIndex: number
  leaderboard: LeaderboardEntry[]
  currentUserId: string
  canManage: boolean
}) {
  const { navigate } = useResponsiveSheet()
  const showSwitcher = availableSeasons.length > 1

  return (
    <div className="px-5 sm:px-6 pb-8 pt-2">
      {/* Identity hero */}
      <div className="flex items-center gap-4 pt-4 pb-5">
        <LeagueAvatar leagueId={leagueId} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground leading-tight break-words">
            {leagueName}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav tiles — Settings / Members / Invite / History */}
      <div className="grid grid-cols-4 gap-1.5 border-t border-white/10 pt-5">
        <NavTile
          icon={SettingsIcon}
          label="Settings"
          onClick={() => navigate('settings')}
        />
        <NavTile icon={Users} label="Members" onClick={() => navigate('members')} />
        <NavTile icon={Link2} label="Invite" onClick={() => navigate('invite')} />
        <NavTile icon={History} label="History" onClick={() => navigate('history')} />
      </div>

      {/* Season switcher chip row */}
      {showSwitcher && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="mb-2 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Season
          </p>
          <div className="-mx-1 flex flex-wrap gap-1.5">
            {availableSeasons.map((s) => {
              const active = s === season
              return (
                <button
                  key={s}
                  type="button"
                  disabled={switching}
                  onClick={() => onPickSeason(s)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase font-mono transition-all',
                    active
                      ? 'border-neon-blue/60 bg-neon-blue/10 text-neon-blue'
                      : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground',
                    switching && 'opacity-60'
                  )}
                >
                  {s}
                  {active && switching && (
                    <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Season form strip */}
      {weeks.length > 0 && (
        <div className={cn('mt-6', !showSwitcher && 'border-t border-white/10 pt-5')}>
          <SeasonFormStrip
            weeks={weeks}
            leagueId={leagueId}
            membersCount={memberCount}
            currentWeekIndex={currentWeekIndex}
          />
        </div>
      )}

      {/* Final standings */}
      {leaderboard.length > 0 && (
        <div className="mt-2">
          <p className="mb-3 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Standings
          </p>
          <FinalStandings
            leagueId={leagueId}
            currentUserId={currentUserId}
            leaderboard={leaderboard}
            allWeeksData={weeks}
            membersCount={memberCount}
            availableSeasons={[season]}
            defaultSeason={season}
          />
        </div>
      )}
    </div>
  )
}

function NavTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-3 transition-all hover:border-primary/40 hover:bg-white/[0.05]"
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-neon-blue transition-colors" />
      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  )
}

// ─── Settings page ──────────────────────────────────────────────────────────

const DAY_CHIPS: Array<{ id: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'; short: string }> = [
  { id: 'sun', short: 'S' },
  { id: 'mon', short: 'M' },
  { id: 'tue', short: 'T' },
  { id: 'wed', short: 'W' },
  { id: 'thu', short: 'T' },
  { id: 'fri', short: 'F' },
  { id: 'sat', short: 'S' },
]

const LOCK_OFFSET_PRESETS = [5, 10, 15, 30, 60]

function SettingsPage({ canManage, leagueId }: { canManage: boolean; leagueId: string }) {
  const [days, setDays] = useState<string[]>(['sun', 'mon'])
  const [includeHolidays, setIncludeHolidays] = useState(true)
  const [lockOffsetMin, setLockOffsetMin] = useState<number>(10)
  const [initial, setInitial] = useState<{
    days: string[]
    includeHolidays: boolean
    lockOffsetMin: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Hydrate on mount.
  useEffect(() => {
    let cancelled = false
    import('@/app/actions/league-settings').then(async ({ getLeagueSettings }) => {
      const { settings, error } = await getLeagueSettings(leagueId)
      if (cancelled) return
      if (error || !settings) {
        setError(error ?? 'Could not load settings')
        return
      }
      setDays(settings.slateDaysIncluded)
      setIncludeHolidays(settings.slateIncludeHolidays)
      setLockOffsetMin(settings.lockOffsetMinutes)
      setInitial({
        days: settings.slateDaysIncluded,
        includeHolidays: settings.slateIncludeHolidays,
        lockOffsetMin: settings.lockOffsetMinutes,
      })
    })
    return () => { cancelled = true }
  }, [leagueId])

  const disabled = !canManage
  const dirty =
    !!initial &&
    (initial.days.join(',') !== [...days].sort().join(',') ||
      initial.includeHolidays !== includeHolidays ||
      initial.lockOffsetMin !== lockOffsetMin)

  const toggleDay = (id: string) => {
    setDays((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const save = async () => {
    if (!dirty || disabled) return
    setSaving(true)
    setError(null)
    try {
      const { updateLeagueSettings } = await import('@/app/actions/league-settings')
      const res = await updateLeagueSettings(leagueId, {
        slateDaysIncluded: days,
        slateIncludeHolidays: includeHolidays,
        lockOffsetMinutes: lockOffsetMin,
      })
      if (!res.success) {
        setError(res.error ?? 'Save failed')
      } else {
        setInitial({ days: [...days], includeHolidays, lockOffsetMin })
        setSavedAt(Date.now())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 sm:px-6 pb-24 pt-4 space-y-7">
      {/* Slate days */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-1">
          Slate
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Which weekdays count toward this league&apos;s parlay each week.
        </p>
        <div className="flex items-center gap-1.5">
          {DAY_CHIPS.map((d) => {
            const active = days.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleDay(d.id)}
                className={cn(
                  'flex-1 rounded-lg border h-11 font-mono text-sm font-bold uppercase transition-all',
                  active
                    ? 'border-neon-blue/60 bg-neon-blue/10 text-neon-blue'
                    : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                title={d.id.toUpperCase()}
              >
                {d.short}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-foreground">Holiday games</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Thanksgiving, Black Friday, Christmas Day always count.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIncludeHolidays((v) => !v)}
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
              includeHolidays
                ? 'border-neon-blue/60 bg-neon-blue/40'
                : 'border-white/15 bg-white/5',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-pressed={includeHolidays}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                includeHolidays ? 'left-[22px]' : 'left-0.5'
              )}
            />
          </button>
        </div>
      </div>

      {/* Lock offset */}
      <div className="border-t border-white/10 pt-5">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-1">
          Lock offset
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Minutes before the first in-slate kickoff that legs lock.
        </p>
        <div className="flex items-center gap-1.5">
          {LOCK_OFFSET_PRESETS.map((n) => {
            const active = lockOffsetMin === n
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => setLockOffsetMin(n)}
                className={cn(
                  'flex-1 rounded-lg border h-11 font-mono text-sm font-bold transition-all',
                  active
                    ? 'border-neon-pink/60 bg-neon-pink/10 text-neon-pink'
                    : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {n}m
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/[0.08] px-3 py-2 text-xs text-neon-pink">
          {error}
        </div>
      )}

      {/* Save button — sticky-ish, lives in the sheet padding */}
      <div className="border-t border-white/10 pt-5">
        <button
          type="button"
          disabled={disabled || !dirty || saving}
          onClick={save}
          className={cn(
            'w-full rounded-full px-5 py-3 text-sm font-extrabold uppercase tracking-wide transition-all',
            dirty
              ? 'bg-neon-blue text-black neon-glow-blue hover:scale-[1.01]'
              : 'border border-white/10 bg-white/[0.04] text-muted-foreground',
            (disabled || !dirty || saving) && 'opacity-60 cursor-not-allowed'
          )}
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </span>
          ) : dirty ? (
            'Save changes'
          ) : savedAt ? (
            'Saved ✓'
          ) : (
            'No changes'
          )}
        </button>
        {dirty && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Lock times for every week will be recomputed.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Members page ───────────────────────────────────────────────────────────

const ROLE_VISUALS = {
  owner: { icon: Crown, color: 'text-neon-blue', label: 'Owner' },
  admin: { icon: Shield, color: 'text-neon-blue', label: 'Admin' },
  member: { icon: UserIcon, color: 'text-neon-blue', label: 'Member' },
} as const

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function MembersPage({
  members,
  currentUserId,
}: {
  members: LeagueSheetMember[]
  currentUserId: string
}) {
  return (
    <div className="px-3 pb-6 pt-2 space-y-1.5">
      {members.map((m) => {
        const Roi = ROLE_VISUALS[m.role].icon
        const initials = getInitials(m.fullName, m.email)
        return (
          <div
            key={m.userId}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5"
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={m.avatarUrl ?? undefined} alt={m.fullName ?? m.email} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                {m.fullName ?? m.email}
                <Roi className={cn('h-3 w-3', ROLE_VISUALS[m.role].color)} />
                <span
                  className={cn(
                    'text-[10px] font-bold tracking-widest uppercase',
                    ROLE_VISUALS[m.role].color
                  )}
                >
                  {ROLE_VISUALS[m.role].label}
                </span>
                {m.userId === currentUserId && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-primary/40 px-1.5 py-0"
                  >
                    You
                  </Badge>
                )}
              </p>
              {m.fullName && (
                <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
              )}
            </div>
          </div>
        )
      })}
      <p className="px-3 pt-3 text-[11px] text-muted-foreground">
        Promote, demote, and remove members from the user-menu avatar (top right).
      </p>
    </div>
  )
}

// ─── Invite page ────────────────────────────────────────────────────────────

function InvitePage({
  leagueId,
  inviteCode: initialInviteCode,
  canRegenerate,
}: {
  leagueId: string
  inviteCode: string
  canRegenerate: boolean
}) {
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    setInviteCode(initialInviteCode)
  }, [initialInviteCode])

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${inviteCode}`
      : `/join/${inviteCode}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!confirm('Regenerate the invite code? The old link will stop working.')) return
    setRegenerating(true)
    const result = await regenerateInviteCode(leagueId)
    setRegenerating(false)
    if (result.inviteCode) setInviteCode(result.inviteCode)
  }

  return (
    <div className="px-5 sm:px-6 pb-6 pt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Anyone with this link can join the league.
      </p>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <code className="block break-all rounded bg-black/40 px-3 py-2 text-sm font-mono text-foreground/90">
          {inviteUrl}
        </code>
        <Button type="button" onClick={handleCopy} className="w-full neon-glow-blue">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy link
            </>
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 p-4 space-y-2">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
          Code
        </p>
        <p className="font-mono text-lg text-neon-pink">{inviteCode || '—'}</p>
        {canRegenerate && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="glass border-destructive/30 text-destructive hover:bg-destructive/5 w-full"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', regenerating && 'animate-spin')} />
            {regenerating ? 'Regenerating…' : 'Regenerate code'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── History page ───────────────────────────────────────────────────────────

function HistoryPage() {
  return (
    <div className="px-5 sm:px-6 pb-8 pt-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center">
        <Lock className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
        <p className="text-sm font-semibold">Coming soon</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          Closed polls, all-time leaderboards, championship recaps, and per-season
          drill-ins land here.
        </p>
      </div>
    </div>
  )
}
