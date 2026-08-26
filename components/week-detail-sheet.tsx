'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import { OddsInput } from '@/components/odds-input'
import { deleteLeg, submitLeg, type SubmitLegResult } from '@/app/actions/legs'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Minus,
  Skull,
  Trash2,
  Trophy,
  Users,
  UserX,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type UserInfo = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

type Week = {
  id: string // parlay id
  week_number: number
  deadline: string
  status: 'open' | 'locked' | 'closed'
  season: string
}

type UserLeg = {
  id: string
  user_id: string
  description?: string
  odds?: string | number
  result: string | null
}

export type LegRoster = {
  id: string
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  description: string
  odds: number
  /** Result is real, description and odds are placeholders — a leg
   *  imported from the two seasons scored in the league's shared note. */
  recordOnly?: boolean
  result: 'win' | 'loss' | 'push' | null
}

export type WeekDetailData = {
  week: Week
  submissionCount: number
  userLeg: UserLeg | null
  weekStats: { wins: number; losses: number; pushes: number; pending: number }
  legs: LegRoster[]
  winners: UserInfo[]
  losers: UserInfo[]
  submittedUsers: UserInfo[]
  notSubmittedUsers: UserInfo[]
  parlayState: 'open' | 'locked' | 'graded' | 'won' | 'lost'
  totalOdds: string | null
}

interface WeekDetailSheetProps {
  open: boolean
  onClose: () => void
  data: WeekDetailData
  leagueId: string
  membersCount: number
  /** When set, sheet opens to this page on first render. */
  initialPage?: 'main' | 'submitted' | 'slackers' | 'edit-leg'
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const formatOdds = (odds: string | number | undefined): string => {
  if (odds == null) return ''
  const s = String(odds).trim()
  const n = parseInt(s.replace(/[^-\d]/g, ''), 10)
  if (isNaN(n)) return s
  return n > 0 ? `+${n}` : `${n}`
}

// ─── Sheet ──────────────────────────────────────────────────────────────────

export function WeekDetailSheet({
  open,
  onClose,
  data,
  leagueId,
  membersCount,
  initialPage = 'main',
}: WeekDetailSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
      sheetMaxHeight="92dvh"
      defaultPage={initialPage}
    >
      <SheetPage name="main" title={`Week ${data.week.week_number}`}>
        <MainPage data={data} leagueId={leagueId} membersCount={membersCount} />
      </SheetPage>

      {data.userLeg && data.parlayState === 'open' && (
        <SheetPage name="edit-leg" title="Edit your leg">
          <EditLegPage userLeg={data.userLeg} weekId={data.week.id} leagueId={leagueId} />
        </SheetPage>
      )}

      <SheetPage name="submitted" title="Locked in">
        <UserListPage
          users={data.submittedUsers}
          emptyText="Nobody's submitted yet."
          highlight="primary"
        />
      </SheetPage>

      <SheetPage name="slackers" title="Slackers">
        <UserListPage
          users={data.notSubmittedUsers}
          emptyText="Everyone's in."
          highlight="muted"
        />
      </SheetPage>
    </ResponsiveSheet>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

function MainPage({
  data,
  leagueId,
  membersCount,
}: {
  data: WeekDetailData
  leagueId: string
  membersCount: number
}) {
  const { navigate } = useResponsiveSheet()

  const { week, userLeg, parlayState, totalOdds, submissionCount, weekStats } = data
  const isOpen = parlayState === 'open'

  return (
    <div className="px-5 sm:px-6 pb-6 space-y-4">
      {/* Hero */}
      <div className="pt-4">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-1">
          {week.season} · Week {week.week_number}
        </div>
        <ParlayStateHeadline state={parlayState} totalOdds={totalOdds} weekStats={weekStats} />
      </div>

      {/* Your leg block — display + delete-to-resubmit. Submission is
          the dock's job (inline composer); the sheet stays read-only. */}
      {isOpen && !userLeg && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm text-muted-foreground">
          You haven&apos;t submitted yet. Close this sheet and use the dock at
          the bottom to lock in your leg.
        </div>
      )}

      {userLeg && (
        <YourLegBlock
          userLeg={userLeg}
          weekId={week.id}
          leagueId={leagueId}
          isOpen={isOpen}
        />
      )}

      {/* Once the parlay locks, drop the Locked-in/Winners/Losers split —
          a flat list of every member's leg shows the result implicitly via
          the icon. Slackers + the locked-in roster only matter while the
          window is still open. */}
      {isOpen ? (
        <div className="space-y-2">
          <DrillRow
            icon={<Users className="h-4 w-4 text-neon-blue" />}
            label="Locked in"
            count={submissionCount}
            total={membersCount}
            users={data.submittedUsers}
            tone="primary"
            onClick={() => navigate('submitted')}
          />
          {data.notSubmittedUsers.length > 0 && (
            <DrillRow
              icon={<UserX className="h-4 w-4 text-muted-foreground" />}
              label="Slackers"
              count={data.notSubmittedUsers.length}
              users={data.notSubmittedUsers}
              tone="muted"
              onClick={() => navigate('slackers')}
            />
          )}
        </div>
      ) : (
        // Flat list of every other member's leg — no header needed; the
        // rows + your-leg block above tell the whole story.
        <div className="space-y-2">
          {data.legs
            .filter((leg) => leg.userId !== userLeg?.user_id)
            .map((leg) => (
              <MemberLegRow key={leg.id} leg={leg} />
            ))}
        </div>
      )}

      {/* Subtle footer: deadline */}
      {week.deadline && (
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Kickoff: {new Date(week.deadline).toLocaleDateString()} ·{' '}
          {new Date(week.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

// ─── Member leg row (read-only view of someone else's leg) ────────────────

function MemberLegRow({ leg }: { leg: WeekDetailData['legs'][number] }) {
  const tone =
    leg.result === 'win'
      ? {
          border: 'border-neon-blue/30',
          text: 'text-neon-blue',
          badgeBg: 'bg-neon-blue',
          badgeIcon: 'text-black',
          Icon: Trophy,
        }
      : leg.result === 'loss'
        ? {
            border: 'border-destructive/30',
            text: 'text-destructive',
            badgeBg: 'bg-destructive',
            badgeIcon: 'text-black',
            Icon: Skull,
          }
        : leg.result === 'push'
          ? {
              border: 'border-white/20',
              text: 'text-foreground/70',
              badgeBg: 'bg-gray-300',
              badgeIcon: 'text-black',
              Icon: Minus,
            }
          : {
              border: 'border-white/15',
              text: 'text-muted-foreground',
              badgeBg: 'bg-white/50',
              badgeIcon: 'text-black',
              Icon: Clock,
            }
  const ResultIcon = tone.Icon
  const oddsLabel = leg.odds > 0 ? `+${leg.odds}` : `${leg.odds}`
  const displayName = leg.fullName ?? leg.email.split('@')[0]
  const initials = getInitials(leg.fullName, leg.email)

  return (
    <div
      className={cn(
        'flex items-center gap-3 w-full rounded-lg border bg-white/[0.02] px-3 py-3',
        tone.border
      )}
    >
      {/* Avatar identifies whose leg this is. Result icon sits as a
          liquid-glass status badge on the avatar's bottom-right — Discord
          / iMessage style. */}
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9 ring-1 ring-white/10">
          <AvatarImage src={leg.avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-black/60',
            tone.badgeBg
          )}
        >
          <ResultIcon
            className={cn('h-3 w-3', tone.badgeIcon)}
            strokeWidth={2.5}
          />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground truncate mb-1">
          {displayName}
        </span>
        <p className="text-sm font-medium text-foreground/90 break-words line-clamp-2">
          {leg.description || 'No description'}
        </p>
      </div>
      {/* Quiet right-aligned odds — reads like a Sleeper line value, not a
          slapped-on pill. */}
      <span
        className={cn(
          'shrink-0 text-base font-bold tabular-nums leading-none',
          leg.odds > 0 ? 'text-foreground/90' : 'text-muted-foreground'
        )}
      >
        {oddsLabel}
      </span>
    </div>
  )
}

// ─── Your-leg block (display + tap-to-edit) ───────────────────────────────

function YourLegBlock({
  userLeg,
  isOpen,
}: {
  userLeg: NonNullable<WeekDetailData['userLeg']>
  weekId: string
  leagueId: string
  isOpen: boolean
}) {
  const { navigate } = useResponsiveSheet()

  // Match the Recent Legs row style on the main page: result icon
  // (Trophy/Skull/Minus/Clock) on the far left, odds + description in the
  // middle, chevron on the right. Tap the row → edit-leg sub-page (where
  // delete also lives). Week label is omitted — sheet is already scoped
  // to one week.
  const tone =
    userLeg.result === 'win'
      ? { border: 'border-neon-blue/30', text: 'text-neon-blue', Icon: Trophy }
      : userLeg.result === 'loss'
        ? { border: 'border-destructive/30', text: 'text-destructive', Icon: Skull }
        : userLeg.result === 'push'
          ? { border: 'border-white/20', text: 'text-foreground/70', Icon: Minus }
          : { border: 'border-primary/30', text: 'text-muted-foreground', Icon: Clock }
  const ResultIcon = tone.Icon
  const interactive = isOpen
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => navigate('edit-leg') : undefined}
      className={cn(
        'group flex items-center gap-3 w-full rounded-lg border bg-white/[0.02] px-3 py-3 text-left transition-colors',
        tone.border,
        interactive && 'hover:bg-white/[0.04]'
      )}
    >
      <ResultIcon aria-hidden className={cn('h-7 w-7 shrink-0', tone.text)} />

      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">
          Your leg
        </span>
        <p className="text-sm font-medium break-words text-foreground/90 line-clamp-2">
          {userLeg.description || 'No description'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'text-base font-bold tabular-nums leading-none',
            (parseInt(String(userLeg.odds ?? '').replace(/[^-\d]/g, ''), 10) || 0) > 0
              ? 'text-foreground/90'
              : 'text-muted-foreground'
          )}
        >
          {formatOdds(userLeg.odds)}
        </span>
        {interactive && (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
    </Tag>
  )
}

// ─── Edit-leg sub-page ─────────────────────────────────────────────────────

function EditLegPage({
  userLeg,
  weekId,
  leagueId,
}: {
  userLeg: NonNullable<WeekDetailData['userLeg']>
  weekId: string
  leagueId: string
}) {
  const router = useRouter()
  const { goBack } = useResponsiveSheet()
  const [description, setDescription] = useState(userLeg.description ?? '')
  const initialOdds = (() => {
    const n = parseInt(String(userLeg.odds ?? '').replace(/[^-\d]/g, ''), 10)
    return isNaN(n) ? -110 : n
  })()
  const [odds, setOdds] = useState<number>(initialOdds)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<SubmitLegResult['warning'] | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setWarning(null)
    const desc = description.trim()
    if (!desc) {
      setError('Add a description for your leg.')
      return
    }
    setSaving(true)
    const result = await submitLeg(weekId, leagueId, {
      description: desc,
      odds: String(odds),
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.warning) {
      setWarning(result.warning)
      router.refresh()
      return
    }
    router.refresh()
    goBack()
  }

  const handleDelete = async () => {
    if (!confirm('Delete your leg? You can re-submit a different one before kickoff.')) {
      return
    }
    setDeleting(true)
    const res = await deleteLeg(weekId, userLeg.id, leagueId)
    setDeleting(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
    goBack()
  }

  return (
    <form
      onSubmit={handleSave}
      className="px-5 sm:px-6 pb-10 sm:pb-12 pt-4 space-y-4"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2.5rem)' }}
    >
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {warning && (
        <div className="rounded-md border border-neon-pink/50 bg-neon-pink/5 px-2.5 py-2 text-xs space-y-1">
          <div className="flex items-start gap-2 text-neon-pink">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="font-bold tracking-wide uppercase">Heads up — saved anyway</span>
          </div>
          <p className="text-foreground/90">{warning.reason}</p>
          {warning.conflictsWith.length > 0 && (
            <p className="text-muted-foreground">
              Conflicts with: <span className="text-foreground">{warning.conflictsWith.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="edit-leg-desc"
          className="block text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-1.5"
        >
          What&apos;s the bet?
        </label>
        <Textarea
          id="edit-leg-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          autoFocus
          className="resize-none rounded-xl border-white/15 bg-white/[0.04] backdrop-blur-md focus-visible:border-neon-blue/60 focus-visible:ring-0 text-base"
        />
      </div>

      <div className="rounded-xl border border-white/15 bg-white/[0.04] backdrop-blur-md px-3 py-3">
        <OddsInput value={odds} onChange={setOdds} />
      </div>

      {/* Action stack — Save changes (primary) on top of Delete leg
          (destructive secondary). Tight internal gap so they read as a
          single related cluster, not two adjacent cards. */}
      <div className="space-y-1">
        <button
          type="submit"
          disabled={saving || deleting}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3',
            'text-sm font-extrabold tracking-wide uppercase',
            'bg-black/60 text-neon-blue',
            'transition-colors hover:bg-neon-blue hover:text-black hover:[text-shadow:none]',
            'active:scale-[0.99]',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save changes
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || deleting}
          className={cn(
            'w-full inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2',
            'text-xs font-bold tracking-wider uppercase',
            'text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {deleting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Deleting
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5" />
              Delete leg
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ─── Headline ───────────────────────────────────────────────────────────────

function ParlayStateHeadline({
  state,
  totalOdds,
  weekStats,
}: {
  state: WeekDetailData['parlayState']
  totalOdds: string | null
  weekStats: WeekDetailData['weekStats']
}) {
  switch (state) {
    case 'open':
      return (
        <h2 className="text-2xl sm:text-3xl font-bold">
          Submissions <span className="text-neon-blue">open</span>
        </h2>
      )
    case 'locked':
      return (
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-neon-blue" />
            Locked, awaiting kickoff
          </h2>
          {totalOdds && (
            <p className="mt-1 text-neon-blue text-2xl font-bold tabular-nums">{totalOdds}</p>
          )}
        </div>
      )
    case 'graded':
      return (
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Grading in progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {weekStats.wins}W &middot; {weekStats.losses}L &middot;{' '}
            {weekStats.pending} pending
          </p>
        </div>
      )
    case 'won':
      return (
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-neon-blue flex items-center gap-2">
            <Trophy className="h-7 w-7 text-neon-blue" />
            League WON
          </h2>
          {totalOdds && (
            <p className="mt-1 text-neon-blue text-2xl font-bold tabular-nums">{totalOdds}</p>
          )}
        </div>
      )
    case 'lost':
      return (
        <h2 className="text-3xl sm:text-4xl font-bold text-destructive flex items-center gap-2">
          <Skull className="h-7 w-7" />
          League LOST
        </h2>
      )
  }
}

// ─── Drill row ──────────────────────────────────────────────────────────────

function DrillRow({
  icon,
  label,
  count,
  total,
  users,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  total?: number
  users: UserInfo[]
  tone: 'primary' | 'destructive' | 'muted'
  onClick: () => void
}) {
  const previewUsers = users.slice(0, 5)
  const remaining = Math.max(0, users.length - previewUsers.length)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
        tone === 'primary' && 'border-white/10 hover:border-neon-blue/40 hover:bg-neon-blue/5',
        tone === 'destructive' && 'border-white/10 hover:border-destructive/40 hover:bg-destructive/5',
        tone === 'muted' && 'border-white/10 hover:border-white/20 hover:bg-white/5'
      )}
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">
          {count}
          {total ? ` of ${total}` : ''}
        </div>
      </div>
      {previewUsers.length > 0 && (
        <div className="flex -space-x-2 shrink-0">
          {previewUsers.map((u) => (
            <Avatar
              key={u.userId}
              className={cn(
                'h-7 w-7 border-2',
                tone === 'primary' && 'border-neon-blue/40',
                tone === 'destructive' && 'border-destructive/40',
                tone === 'muted' && 'border-white/10 opacity-60'
              )}
            >
              <AvatarImage src={u.avatarUrl ?? undefined} alt={u.fullName ?? u.email} />
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                {getInitials(u.fullName, u.email)}
              </AvatarFallback>
            </Avatar>
          ))}
          {remaining > 0 && (
            <div className="h-7 w-7 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              +{remaining}
            </div>
          )}
        </div>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </button>
  )
}

// ─── User list page ─────────────────────────────────────────────────────────

function UserListPage({
  users,
  emptyText,
  highlight,
}: {
  users: UserInfo[]
  emptyText: string
  highlight: 'primary' | 'destructive' | 'muted'
}) {
  if (users.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted-foreground">{emptyText}</p>
    )
  }
  return (
    <div className="px-3 pb-4 space-y-1.5">
      {users.map((u) => (
        <div
          key={u.userId}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2.5',
            highlight === 'primary' && 'border-white/10',
            highlight === 'destructive' && 'border-destructive/20 bg-destructive/5',
            highlight === 'muted' && 'border-white/10 opacity-80'
          )}
        >
          <Avatar
            className={cn(
              'h-9 w-9 shrink-0 border-2',
              highlight === 'primary' && 'border-neon-blue/40',
              highlight === 'destructive' && 'border-destructive/40',
              highlight === 'muted' && 'border-white/10'
            )}
          >
            <AvatarImage src={u.avatarUrl ?? undefined} alt={u.fullName ?? u.email} />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
              {getInitials(u.fullName, u.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{u.fullName ?? u.email}</p>
            {u.fullName && (
              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
            )}
          </div>
          {highlight === 'primary' && <Check className="h-4 w-4 text-neon-blue shrink-0" />}
        </div>
      ))}
    </div>
  )
}
