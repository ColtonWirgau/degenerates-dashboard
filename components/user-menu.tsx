'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import { logout } from '@/app/actions/auth'
import { setScenario, setMockUser, setSeasonPhase } from '@/app/actions/dev-toolbar'
import type { DevPhaseData, DevSeasonPhase } from '@/lib/data/dev-toolbar-data'
import { updateProfile } from '@/app/actions/profile'
import {
  AlertCircle,
  ArrowRight,
  Clock,
  FlaskConical,
  LogOut,
  Settings,
  Upload,
  User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CurrentUser {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}

interface DevToolbarData {
  scenarios: Array<{ id: string; name: string; hint: string }>
  activeScenarioId: string
  users: Array<{ id: string; fullName: string | null; email: string }>
  activeUserId: string | null
}

interface UserMenuProps {
  user: CurrentUser
  /** Mock-mode dev controls. Null in production. */
  mock?: DevToolbarData | null
  /** Neon-mode dev control — season-phase time travel. Null outside dev. */
  devPhase?: DevPhaseData | null
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

// ─── Top-level component ────────────────────────────────────────────────────

/**
 * Single avatar trigger that opens a multi-page sheet for everything user-
 * scoped: identity, league switching, per-league management (members,
 * invites). Replaces the previous LeaguePicker pill + avatar dropdown +
 * separate ProfileSheet + separate MemberManagementSheet.
 */
export function UserMenu({ user, mock, devPhase }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const initials = getInitials(user.fullName, user.email)

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
            devPhase={devPhase ?? null}
            mockEnabled={!!mock}
            mockScenarioName={
              mock?.scenarios.find((s) => s.id === mock.activeScenarioId)?.name ?? null
            }
          />
        </SheetPage>

        <SheetPage name="profile" title="Edit Profile">
          <ProfilePage user={user} onSaved={() => setOpen(false)} />
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
  devPhase,
  mockEnabled,
  mockScenarioName,
}: {
  user: CurrentUser
  devPhase: DevPhaseData | null
  mockEnabled: boolean
  mockScenarioName: string | null
}) {
  const { navigate } = useResponsiveSheet()
  const initials = getInitials(user.fullName, user.email)

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

