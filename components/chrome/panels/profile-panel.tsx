'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, LogOut, Upload } from 'lucide-react'
import { updateProfile } from '@/app/actions/profile'
import { logout } from '@/app/actions/auth'
import { closePanel } from '@/components/chrome/canvas-store'
import type { CurrentUser } from '@/components/user-menu'
import { cn } from '@/lib/utils'

export interface ProfilePanelProps {
  user: CurrentUser
  /** Where you sit on the table, 1-based. Null when unranked. */
  myRank: number | null
  /** Your record this season. */
  stats: { wins: number; losses: number; pushes: number; winRate: number } | null
}

/**
 * YOU — one panel, no pages.
 *
 * Your face on the card's right edge is a door to yourself, and there's
 * little enough behind it that it all fits on one surface: your name and
 * your picture (editable in place, not through an "Edit Profile" page
 * that would say the same word twice), your record, and the way out.
 *
 * Everything about the LEAGUE lives behind the masthead's season lockup
 * instead. One noun per door is the whole organising idea of this shell.
 */
export function ProfilePanel({ user, myRank, stats }: ProfilePanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Pick an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError(null)
    setDirty(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateProfile(new FormData(e.currentTarget))
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setPreview(null)
    setDirty(false)
    router.refresh()
  }

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Your face, and the button to change it — the same object, so
            tapping the picture is what edits the picture. */}
        <div className="flex flex-col items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative rounded-full"
            aria-label="Change your picture"
          >
            <Avatar className="ring-primary/30 group-hover:ring-primary/60 h-20 w-20 ring-4 transition-all">
              <AvatarImage
                src={preview ?? user.avatarUrl ?? undefined}
                alt={user.fullName ?? user.email}
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {initialsOf(user.fullName, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="bg-primary text-primary-foreground absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-[#0A0A0A]">
              <Upload className="h-3.5 w-3.5" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            name="avatar"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-muted-foreground text-[11px]">{user.email}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-[11px]">
            Name
          </Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={user.fullName ?? ''}
            placeholder="Your name"
            onChange={() => setDirty(true)}
            required
            className="glass border-primary/30"
          />
        </div>

        {error && (
          <div className="glass border-destructive/50 text-destructive flex items-start gap-2 rounded-lg p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Only offered once there's something to save — a permanently
            lit Save button is a permanent small nag. */}
        {dirty && (
          <Button type="submit" disabled={saving} className="neon-glow-blue w-full">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </form>

      {/* Your season, in the four numbers that matter. */}
      {stats && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-muted-foreground mb-2.5 text-[10px] font-bold tracking-[0.3em] uppercase">
            This season
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Rank" value={myRank != null ? `#${myRank}` : '–'} tone="blue" />
            <Stat label="Hit" value={stats.wins} tone="blue" />
            <Stat label="Missed" value={stats.losses} tone="pink" />
            <Stat label="Rate" value={`${Math.round(stats.winRate)}%`} />
          </div>
        </div>
      )}

      <form action={logout} className="mt-auto pt-6">
        <button
          type="submit"
          onClick={closePanel}
          className="text-destructive/80 hover:text-destructive hover:bg-destructive/5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold tracking-[0.2em] uppercase transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </form>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'blue' | 'pink'
}) {
  return (
    <div>
      <p
        className={cn(
          'font-display text-xl leading-none',
          tone === 'blue'
            ? 'text-neon-blue'
            : tone === 'pink'
              ? 'text-destructive'
              : 'text-foreground/80'
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[9px] tracking-[0.2em] uppercase">
        {label}
      </p>
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
