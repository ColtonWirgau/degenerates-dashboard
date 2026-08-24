'use client'

/**
 * The league's own pages — standings, settings, members, invites,
 * history. They're pages rather than a sheet because they all live
 * *inside* one: the season sheet, behind the masthead lockup. Nothing
 * about YOU is in here; that's the profile sheet's business.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SheetPageKebab,
  useResponsiveSheet,
  type SheetPageKebabItem,
} from '@/components/ui/responsive-sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FinalStandings } from '@/components/final-standings'
import {
  inviteMember,
  regenerateInviteCode,
  removeMember,
  updateMemberRole,
} from '@/app/actions/leagues'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'
import {
  AlertCircle,
  Check,
  Copy,
  Crown,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  User as UserIcon,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type LeagueSheetMember = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'member'
}

/** Compact row for the in-sheet league switcher. */
export type LeagueSwitcherRow = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}


// Full standings — the complete table with dot traces; rows drill into
// the member's detail page.
export function StandingsPage({
  currentUserId,
  leaderboard,
  weeks,
  onSelectUser,
}: {
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  weeks: WeekDetailData[]
  onSelectUser: (userId: string) => void
}) {
  const { navigate } = useResponsiveSheet()
  return (
    <div className="px-5 sm:px-6 pb-6 pt-2">
      <FinalStandings
        currentUserId={currentUserId}
        leaderboard={leaderboard}
        allWeeksData={weeks}
        onSelectUser={(id) => {
          onSelectUser(id)
          navigate('user')
        }}
      />
    </div>
  )
}

export function NavTile({
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

export function SettingsPage({ canManage, leagueId }: { canManage: boolean; leagueId: string }) {
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

export function MembersPage({
  leagueId,
  members,
  currentUserId,
  currentUserRole,
}: {
  leagueId: string
  members: LeagueSheetMember[]
  currentUserId: string
  currentUserRole: 'owner' | 'admin' | 'member'
}) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isOwner = currentUserRole === 'owner'

  const buildKebabItems = (m: LeagueSheetMember): SheetPageKebabItem[] => {
    if (!canManage || m.userId === currentUserId || m.role === 'owner') return []
    const items: SheetPageKebabItem[] = []
    if (isOwner && m.role === 'member') {
      items.push({
        key: 'promote',
        label: 'Promote to admin',
        icon: Shield,
        onSelect: async () => {
          setUpdatingId(m.userId)
          await updateMemberRole(leagueId, m.userId, 'admin')
          setUpdatingId(null)
          router.refresh()
        },
      })
    }
    if (isOwner && m.role === 'admin') {
      items.push({
        key: 'demote',
        label: 'Demote to member',
        icon: UserIcon,
        onSelect: async () => {
          setUpdatingId(m.userId)
          await updateMemberRole(leagueId, m.userId, 'member')
          setUpdatingId(null)
          router.refresh()
        },
      })
    }
    items.push({
      key: 'remove',
      label: 'Remove from league',
      icon: UserMinus,
      variant: 'destructive',
      onSelect: async () => {
        if (!confirm(`Remove ${m.fullName ?? m.email} from the league?`)) return
        setUpdatingId(m.userId)
        await removeMember(leagueId, m.userId)
        setUpdatingId(null)
        router.refresh()
      },
    })
    return items
  }

  return (
    <div className="px-3 pb-6 pt-2 space-y-1.5">
      {members.map((m) => {
        const Roi = ROLE_VISUALS[m.role].icon
        const initials = getInitials(m.fullName, m.email)
        const items = buildKebabItems(m)
        return (
          <div
            key={m.userId}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5',
              updatingId === m.userId && 'opacity-60 transition-opacity'
            )}
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
            {items.length > 0 && <SheetPageKebab items={items} forceMenu />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Invite page ────────────────────────────────────────────────────────────

export function InvitePage({
  leagueId,
  inviteCode: initialInviteCode,
  canManage,
}: {
  leagueId: string
  inviteCode: string
  canManage: boolean
}) {
  const canRegenerate = canManage
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

      {canManage && <InviteByEmail leagueId={leagueId} />}
    </div>
  )
}

// Email invite — targeted invite for a specific address. Folded into the
// Invite page so the league sheet is the one home for member recruitment.
function InviteByEmail({ leagueId }: { leagueId: string }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{
    message: string
    inviteUrl: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    const result = await inviteMember(leagueId, email)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess({
      message: result.message ?? 'Invitation sent.',
      inviteUrl: result.inviteUrl,
    })
    setEmail('')
  }

  const handleCopy = async () => {
    if (!success?.inviteUrl) return
    await navigator.clipboard.writeText(success.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 p-4 space-y-3"
    >
      <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
        <Mail className="h-3 w-3" />
        Invite by email
      </p>
      <div className="space-y-2">
        <Label htmlFor="invite-email" className="sr-only">
          Email
        </Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          required
          className="glass border-primary/30"
        />
      </div>
      {error && (
        <div className="glass border-destructive/50 p-3 rounded-lg text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="glass border-neon-blue/50 bg-neon-blue/5 p-3 rounded-lg text-sm space-y-2">
          <p className="text-neon-blue font-semibold">{success.message}</p>
          {success.inviteUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs bg-black/40 px-2 py-1 rounded">
                {success.inviteUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="glass border-neon-blue/40 shrink-0"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>
      )}
      <Button type="submit" disabled={submitting} className="w-full neon-glow-blue">
        {submitting ? (
          'Sending…'
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Send invite
          </>
        )}
      </Button>
    </form>
  )
}

// ─── History page ───────────────────────────────────────────────────────────

export function HistoryPage() {
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
