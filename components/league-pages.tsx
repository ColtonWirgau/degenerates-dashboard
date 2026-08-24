'use client'

/**
 * The league's own surfaces — how its slate is configured, the full
 * standings table, the invite flow.
 *
 * SlateSettings renders inline on the season panel rather than behind a
 * door: it's three rows of chips, the panel has the room, and a modal
 * you have to open to change a toggle is a modal you'll forget exists.
 * The other two are pages in a sheet, because a table and a flow need
 * more width than a 19rem reveal has.
 *
 * The roster isn't here: who's in the league is a fact about the season
 * you're looking at, so it sits on the season panel beside the years.
 * Nothing about YOU is here either; that's the profile panel's business.
 */

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { inviteMember, regenerateInviteCode } from '@/app/actions/leagues'
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
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

export function SlateSettings({
  canManage,
  leagueId,
}: {
  canManage: boolean
  leagueId: string
}) {
  const [days, setDays] = useState<string[]>(['sun', 'mon'])
  const [includeHolidays, setIncludeHolidays] = useState(true)
  const [initial, setInitial] = useState<{
    days: string[]
    includeHolidays: boolean
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
      setInitial({
        days: settings.slateDaysIncluded,
        includeHolidays: settings.slateIncludeHolidays,
      })
    })
    return () => { cancelled = true }
  }, [leagueId])

  const disabled = !canManage
  // Both sides sorted, or a league whose days came back as ['sun','mon']
  // reads as permanently unsaved against the same set sorted.
  const dirty =
    !!initial &&
    ([...initial.days].sort().join(',') !== [...days].sort().join(',') ||
      initial.includeHolidays !== includeHolidays)

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
      })
      if (!res.success) {
        setError(res.error ?? 'Save failed')
      } else {
        setInitial({ days: [...days], includeHolidays })
        setSavedAt(Date.now())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Slate days */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground mb-1">
          Slate
        </p>
        <p className="text-[11px] text-muted-foreground mb-2.5">
          Which weekdays count toward the parlay each week.
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
                  'flex-1 rounded-lg border h-9 font-mono text-xs font-bold uppercase transition-all',
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
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Holiday games</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">
              Thanksgiving, Black Friday, Christmas always count.
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

      {error && (
        <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/[0.08] px-3 py-2 text-xs text-neon-pink">
          {error}
        </div>
      )}

      {/* Only offered once there's something to save — a permanently lit
          Save button on a panel you scroll past is a permanent small nag. */}
      {dirty && (
        <div>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={save}
            className={cn(
              'bg-neon-blue neon-glow-blue w-full rounded-full px-5 py-2.5 text-xs font-extrabold tracking-wide text-black uppercase transition-all hover:scale-[1.01]',
              (disabled || saving) && 'cursor-not-allowed opacity-60'
            )}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </span>
            ) : (
              'Save changes'
            )}
          </button>
          <p className="text-muted-foreground mt-1.5 text-center text-[10px]">
            Lock times for every week will be recomputed.
          </p>
        </div>
      )}
      {!dirty && savedAt && (
        <p className="text-neon-blue text-center text-[10px] font-bold tracking-[0.2em] uppercase">
          Saved
        </p>
      )}
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