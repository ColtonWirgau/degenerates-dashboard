'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveSheet,
  SheetPage,
  SheetPageKebab,
  type SheetPageKebabItem,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import { logout } from '@/app/actions/auth'
import { setScenario, setMockUser, setSeasonPhase } from '@/app/actions/dev-toolbar'
import type { DevPhaseData, DevSeasonPhase } from '@/lib/data/dev-toolbar-data'
import { updateProfile } from '@/app/actions/profile'
import {
  getLeagueMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  regenerateInviteCode,
} from '@/app/actions/leagues'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Crown,
  FlaskConical,
  Link2,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Upload,
  User as UserIcon,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CurrentUser {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}

interface LeagueRow {
  id: string
  name: string
  invite_code: string
  league_members: Array<{ role: string }>
}

interface DevToolbarData {
  scenarios: Array<{ id: string; name: string; hint: string }>
  activeScenarioId: string
  users: Array<{ id: string; fullName: string | null; email: string }>
  activeUserId: string | null
}

interface UserMenuProps {
  user: CurrentUser
  leagues: LeagueRow[]
  /** Mock-mode dev controls. Null in production. */
  mock?: DevToolbarData | null
  /** Neon-mode dev control — season-phase time travel. Null outside dev. */
  devPhase?: DevPhaseData | null
}

interface Member {
  id: string
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const ROLE_VISUALS = {
  owner: { icon: Crown, color: 'text-neon-blue', label: 'Owner' },
  admin: { icon: Shield, color: 'text-neon-blue', label: 'Admin' },
  member: { icon: UserIcon, color: 'text-neon-blue', label: 'Member' },
} as const

// ─── Top-level component ────────────────────────────────────────────────────

/**
 * Single avatar trigger that opens a multi-page sheet for everything user-
 * scoped: identity, league switching, per-league management (members,
 * invites). Replaces the previous LeaguePicker pill + avatar dropdown +
 * separate ProfileSheet + separate MemberManagementSheet.
 */
export function UserMenu({ user, leagues, mock, devPhase }: UserMenuProps) {
  const params = useParams<{ id?: string }>()
  const currentLeagueId = params?.id
  const [open, setOpen] = useState(false)
  const initials = getInitials(user.fullName, user.email)

  // Lazy-loaded per-league data — only fetch when the user drills into
  // a 'league' or 'members' sub-page. Lives at the top level so it's shared
  // across the per-league pages.
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(currentLeagueId ?? null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersPending, startMembersTransition] = useTransition()
  const [membersError, setMembersError] = useState<string | null>(null)

  const fetchMembers = (leagueId: string) => {
    setMembersError(null)
    startMembersTransition(async () => {
      const res = await getLeagueMembers(leagueId)
      if (res.error) {
        setMembersError(res.error)
        setMembers([])
        return
      }
      setMembers(res.members as Member[])
    })
  }

  // Reset on close so reopening doesn't show stale data
  useEffect(() => {
    if (!open) {
      setActiveLeagueId(currentLeagueId ?? null)
      setMembers([])
      setMembersError(null)
    }
  }, [open, currentLeagueId])

  const activeLeague = leagues.find((l) => l.id === activeLeagueId)
  const activeRole = (activeLeague?.league_members?.[0]?.role ?? 'member') as
    | 'owner'
    | 'admin'
    | 'member'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
        aria-label="Account & leagues"
      >
        <Avatar className="h-10 w-10 ring-2 ring-primary/50 group-hover:ring-primary transition-all cursor-pointer">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName ?? user.email} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>

      <ResponsiveSheet
        open={open}
        onClose={() => setOpen(false)}
        panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
        sheetMaxHeight="92dvh"
      >
        <SheetPage name="main">
          <MainPage
            user={user}
            leagues={leagues}
            currentLeagueId={currentLeagueId}
            devPhase={devPhase ?? null}
            mockEnabled={!!mock}
            mockScenarioName={
              mock?.scenarios.find((s) => s.id === mock.activeScenarioId)?.name ?? null
            }
            onClose={() => setOpen(false)}
            onPickLeagueToManage={(id) => {
              setActiveLeagueId(id)
              if (id) fetchMembers(id)
            }}
          />
        </SheetPage>

        <SheetPage name="profile" title="Edit Profile">
          <ProfilePage user={user} onSaved={() => setOpen(false)} />
        </SheetPage>

        <SheetPage name="league" title={activeLeague?.name ?? 'League'}>
          {activeLeague ? (
            <LeaguePage
              league={activeLeague}
              role={activeRole}
              isCurrent={activeLeague.id === currentLeagueId}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </SheetPage>

        <SheetPage name="members" title="Members">
          <MembersPage
            leagueId={activeLeagueId ?? ''}
            currentUserId={user.id}
            members={members}
            pending={membersPending}
            error={membersError}
            currentUserRole={activeRole}
            onMutate={() => activeLeagueId && fetchMembers(activeLeagueId)}
          />
        </SheetPage>

        <SheetPage name="invite-email" title="Invite by email">
          <InviteEmailPage leagueId={activeLeagueId ?? ''} />
        </SheetPage>

        <SheetPage name="invite-link" title="Invite link">
          <InviteLinkPage league={activeLeague} />
        </SheetPage>

        {mock && (
          <SheetPage name="mock" title="Mock controls">
            <MockPage data={mock} />
          </SheetPage>
        )}
      </ResponsiveSheet>
    </>
  )
}

// ─── Main page (identity + leagues + sign out) ──────────────────────────────

function MainPage({
  user,
  leagues,
  currentLeagueId,
  devPhase,
  mockEnabled,
  mockScenarioName,
  onClose,
  onPickLeagueToManage,
}: {
  user: CurrentUser
  leagues: LeagueRow[]
  currentLeagueId: string | undefined
  devPhase: DevPhaseData | null
  mockEnabled: boolean
  mockScenarioName: string | null
  onClose: () => void
  onPickLeagueToManage: (leagueId: string) => void
}) {
  const router = useRouter()
  const { navigate } = useResponsiveSheet()
  const initials = getInitials(user.fullName, user.email)

  // Tap on a league row:
  //   - Inactive league → switch (close sheet, navigate)
  //   - Active league   → drill into per-league management
  const handleLeagueTap = (id: string) => {
    if (id === currentLeagueId) {
      onPickLeagueToManage(id)
      navigate('league')
      return
    }
    onClose()
    router.push(`/leagues/${id}`)
  }

  return (
    <div className="px-5 sm:px-6 pb-8">
      {/* Identity hero — quiet, scannable */}
      <div className="flex items-center gap-4 pt-6 pb-6">
        <Avatar className="h-14 w-14 ring-2 ring-primary/40 shrink-0">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName ?? user.email} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-foreground truncate leading-tight">
            {user.fullName ?? user.email}
          </h2>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('profile')}
          className="rounded-full p-2 text-muted-foreground hover:text-neon-blue hover:bg-white/5 transition-colors shrink-0"
          aria-label="Edit profile"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Leagues list */}
      <div className="border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Your Leagues
          </h3>
          <Link
            href="/leagues/new"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-neon-blue hover:text-primary transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </Link>
        </div>
        <div className="space-y-1.5">
          {leagues.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">
              You&apos;re not in any leagues yet.
            </p>
          )}
          {leagues.map((league) => {
            const role = (league.league_members?.[0]?.role ?? 'member') as
              | 'owner'
              | 'admin'
              | 'member'
            const isCurrent = league.id === currentLeagueId
            const Roi = ROLE_VISUALS[role].icon
            return (
              <button
                key={league.id}
                type="button"
                onClick={() => handleLeagueTap(league.id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                  isCurrent
                    ? 'border-primary/60 bg-primary/5 hover:bg-primary/10'
                    : 'border-white/10 hover:border-primary/40 hover:bg-white/5'
                )}
              >
                <Roi
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isCurrent ? ROLE_VISUALS[role].color : 'text-muted-foreground'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-semibold truncate',
                      isCurrent && 'text-neon-blue'
                    )}
                  >
                    {league.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {ROLE_VISUALS[role].label}
                    {isCurrent && ' · Active'}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-neon-blue">
                    Manage
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-neon-blue transition-colors" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Season phase (dev, neon mode) — time-travel the season-state
          reads so any phase's UI can be previewed against real data. */}
      {devPhase && <DevPhaseSwitcher data={devPhase} />}

      {/* Mock controls — only present in mock mode. Quiet entry that drills
          into a sub-page so the dropdown doesn't clutter the bottom-left. */}
      {mockEnabled && (
        <button
          type="button"
          onClick={() => navigate('mock')}
          className="mt-5 flex w-full items-center gap-3 rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-3 py-2.5 text-left transition-all hover:border-neon-pink/60 hover:bg-neon-pink/10"
        >
          <FlaskConical className="h-4 w-4 shrink-0 text-neon-pink" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-pink">
              Mock controls
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {mockScenarioName ? `Scenario: ${mockScenarioName}` : 'Pick a scenario'}
            </div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}

      {/* Sign out */}
      <form action={logout} className="mt-6 border-t border-white/10 pt-5">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold tracking-[0.2em] uppercase text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </form>
    </div>
  )
}

// ─── Season phase switcher (dev, neon mode) ────────────────────────────────

function DevPhaseSwitcher({ data }: { data: DevPhaseData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const pick = (id: DevSeasonPhase) => {
    startTransition(async () => {
      await setSeasonPhase(id)
      router.refresh()
    })
  }

  return (
    <div className="mt-5 rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-neon-pink">
        <FlaskConical className="h-3 w-3" />
        Season phase
        <span className="normal-case font-medium tracking-normal text-muted-foreground">
          dev only
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {data.phases.map((p) => {
          const active = p.id === data.active
          return (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => pick(p.id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors',
                active
                  ? 'border-neon-pink/60 bg-neon-pink/15 text-neon-pink'
                  : 'border-white/10 text-muted-foreground hover:border-neon-pink/30 hover:text-foreground',
                pending && 'opacity-60'
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mock controls sub-page ────────────────────────────────────────────────

function MockPage({ data }: { data: DevToolbarData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { scenarios, activeScenarioId, users, activeUserId } = data

  const pickScenario = (id: string) => {
    startTransition(async () => {
      await setScenario(id)
      router.refresh()
    })
  }
  const pickUser = (id: string) => {
    startTransition(async () => {
      await setMockUser(id)
      router.refresh()
    })
  }

  return (
    <div className="px-5 sm:px-6 pb-6 pt-4 space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-neon-pink">
          <Clock className="h-3 w-3" />
          Scenario
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Time-travel + UI states. The active scenario persists in a cookie.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {scenarios.map((s) => {
            const active = s.id === activeScenarioId
            return (
              <button
                key={s.id}
                type="button"
                disabled={pending}
                onClick={() => pickScenario(s.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-all',
                  active
                    ? 'border-neon-pink/60 bg-neon-pink/10 text-neon-pink'
                    : 'border-white/10 hover:border-neon-pink/30 hover:bg-white/5'
                )}
              >
                <div className="text-xs font-semibold">{s.name}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {s.hint}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-white/10 pt-5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue">
          <UserIcon className="h-3 w-3" />
          Identity
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Who you&apos;re &ldquo;logged in&rdquo; as in mock mode.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {users.slice(0, 8).map((u) => {
            const active = u.id === activeUserId
            return (
              <button
                key={u.id}
                type="button"
                disabled={pending}
                onClick={() => pickUser(u.id)}
                title={u.email}
                className={cn(
                  'truncate rounded-md border px-2 py-1.5 text-left text-[11px] transition-all',
                  active
                    ? 'border-neon-blue/60 bg-neon-blue/10 text-neon-blue'
                    : 'border-white/10 hover:border-neon-blue/30 hover:bg-white/5'
                )}
              >
                <span className="block truncate font-medium">{u.fullName ?? u.email}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Profile sub-page ───────────────────────────────────────────────────────

function ProfilePage({ user, onSaved }: { user: CurrentUser; onSaved: () => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const initials = getInitials(user.fullName, user.email)
  const currentAvatar = preview ?? user.avatarUrl ?? undefined

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
    setPreview(null)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 px-5 sm:px-6 pb-6 pt-4">
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-24 w-24 ring-4 ring-primary/30">
          <AvatarImage src={currentAvatar} alt={user.fullName ?? user.email} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <input
          ref={fileInputRef}
          type="file"
          name="avatar"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="glass border-primary/30"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Avatar
        </Button>
        <p className="text-[11px] text-muted-foreground">PNG, JPG, GIF · max 2MB</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={user.fullName ?? ''}
          placeholder="Your name"
          required
          className="glass border-primary/30"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={user.email}
          disabled
          className="glass border-primary/30 opacity-50 cursor-not-allowed"
        />
        <p className="text-[11px] text-muted-foreground">Email is fixed by your account.</p>
      </div>

      {error && (
        <div className="glass border-destructive/50 p-3 rounded-lg text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full neon-glow-blue">
        {loading ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}

// ─── League sub-page (per-league actions) ──────────────────────────────────

function LeaguePage({
  league,
  role,
  isCurrent,
  onClose,
}: {
  league: LeagueRow
  role: 'owner' | 'admin' | 'member'
  isCurrent: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { navigate } = useResponsiveSheet()
  const Roi = ROLE_VISUALS[role].icon
  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="px-5 sm:px-6 pb-6 pt-4">
      <div className="flex items-center gap-2 text-sm">
        <Roi className={cn('h-4 w-4', ROLE_VISUALS[role].color)} />
        <span className="font-semibold">You&apos;re an {ROLE_VISUALS[role].label.toLowerCase()}</span>
      </div>

      <div className="mt-5 space-y-1.5">
        {!isCurrent && (
          <ActionRow
            icon={ArrowRight}
            label="Open league"
            description="Switch to this league"
            onClick={() => {
              onClose()
              router.push(`/leagues/${league.id}`)
            }}
          />
        )}

        {canManage && (
          <>
            <ActionRow
              icon={Users}
              label="Members"
              description="Roles, kicks, the works"
              onClick={() => navigate('members')}
            />
            <ActionRow
              icon={Mail}
              label="Invite by email"
              description="Send an invite to a specific email"
              onClick={() => navigate('invite-email')}
            />
            <ActionRow
              icon={Link2}
              label="Invite link"
              description="Share a join code anyone can use"
              onClick={() => navigate('invite-link')}
            />
          </>
        )}

        {!canManage && (
          <ActionRow
            icon={UserMinus}
            label="Leave league"
            description="You can rejoin with an invite"
            tone="destructive"
            onClick={() => {
              if (confirm('Leave this league? You can rejoin with an invite link.')) {
                console.warn('[mock] leaveLeague no-op')
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

function ActionRow({
  icon: Icon,
  label,
  description,
  tone = 'default',
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  tone?: 'default' | 'destructive'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all',
        tone === 'destructive'
          ? 'border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5'
          : 'border-white/10 hover:border-primary/40 hover:bg-white/5'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          tone === 'destructive' ? 'text-destructive' : 'text-neon-blue'
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-sm font-semibold',
            tone === 'destructive' ? 'text-destructive' : 'text-foreground'
          )}
        >
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-muted-foreground">{description}</div>
        )}
      </div>
      <ArrowRight
        className={cn(
          'h-3.5 w-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform',
          tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground group-hover:text-neon-blue'
        )}
      />
    </button>
  )
}

// ─── Members sub-page ──────────────────────────────────────────────────────

function MembersPage({
  leagueId,
  currentUserId,
  members,
  pending,
  error,
  currentUserRole,
  onMutate,
}: {
  leagueId: string
  currentUserId: string
  members: Member[]
  pending: boolean
  error: string | null
  currentUserRole: 'owner' | 'admin' | 'member'
  onMutate: () => void
}) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isOwner = currentUserRole === 'owner'

  const buildKebabItems = (m: Member): SheetPageKebabItem[] => {
    if (!canManage || m.user_id === currentUserId || m.role === 'owner') return []
    const items: SheetPageKebabItem[] = []
    if (isOwner && m.role === 'member') {
      items.push({
        key: 'promote',
        label: 'Promote to admin',
        icon: Shield,
        onSelect: async () => {
          setUpdatingId(m.id)
          await updateMemberRole(leagueId, m.user_id, 'admin')
          setUpdatingId(null)
          onMutate()
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
          setUpdatingId(m.id)
          await updateMemberRole(leagueId, m.user_id, 'member')
          setUpdatingId(null)
          onMutate()
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
        if (!confirm(`Remove ${m.full_name ?? m.email} from the league?`)) return
        setUpdatingId(m.id)
        await removeMember(leagueId, m.user_id)
        setUpdatingId(null)
        onMutate()
        router.refresh()
      },
    })
    return items
  }

  if (error) {
    return (
      <div className="px-6 py-12 text-center">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }
  if (pending && members.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading members…</p>
    )
  }
  if (members.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted-foreground">
        No members yet.
      </p>
    )
  }

  return (
    <div className="px-3 pb-4 space-y-1.5">
      {members.map((m) => {
        const Roi = ROLE_VISUALS[m.role].icon
        const items = buildKebabItems(m)
        const initials = getInitials(m.full_name, m.email)
        return (
          <div
            key={m.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5',
              updatingId === m.id && 'opacity-60 transition-opacity'
            )}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={m.avatar_url ?? undefined} alt={m.full_name ?? m.email} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                {m.full_name ?? m.email}
                <Roi className={cn('h-3 w-3', ROLE_VISUALS[m.role].color)} />
                <span className={cn('text-[10px] font-bold tracking-widest uppercase', ROLE_VISUALS[m.role].color)}>
                  {ROLE_VISUALS[m.role].label}
                </span>
                {m.user_id === currentUserId && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 px-1.5 py-0">
                    You
                  </Badge>
                )}
              </p>
              {m.full_name && (
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

// ─── Invite by email sub-page ──────────────────────────────────────────────

function InviteEmailPage({ leagueId }: { leagueId: string }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ message: string; inviteUrl: string | null } | null>(
    null
  )
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
    setSuccess({ message: result.message ?? 'Invitation sent.', inviteUrl: result.inviteUrl })
    setEmail('')
  }

  const handleCopy = async () => {
    if (!success?.inviteUrl) return
    await navigator.clipboard.writeText(success.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 sm:px-6 pb-6 pt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Send an invite to a specific email. They&apos;ll be added when they sign up or sign in.
      </p>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
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
        {submitting ? 'Sending…' : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Send invite
          </>
        )}
      </Button>
    </form>
  )
}

// ─── Invite link sub-page ──────────────────────────────────────────────────

function InviteLinkPage({ league }: { league: LeagueRow | undefined }) {
  const [inviteCode, setInviteCode] = useState(league?.invite_code ?? '')
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Sync if parent re-renders with a new code (e.g. router.refresh after regen)
  useEffect(() => {
    if (league?.invite_code) setInviteCode(league.invite_code)
  }, [league?.invite_code])

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteCode}` : `/join/${inviteCode}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!league) return
    if (!confirm('Regenerate the invite code? The old link will stop working.')) return
    setRegenerating(true)
    const result = await regenerateInviteCode(league.id)
    setRegenerating(false)
    if (result.inviteCode) setInviteCode(result.inviteCode)
  }

  return (
    <div className="px-5 sm:px-6 pb-6 pt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Anyone with this link can join the league.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <code className="block break-all text-sm bg-black/40 px-3 py-2 rounded text-foreground/90 font-mono">
          {inviteUrl}
        </code>
        <Button
          type="button"
          onClick={handleCopy}
          className="w-full neon-glow-blue"
        >
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
      </div>
    </div>
  )
}
