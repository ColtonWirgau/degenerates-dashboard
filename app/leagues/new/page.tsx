'use client'

// 3-step league-creation wizard:
//   1. Name + invite code
//   2. Slate config (which weekdays count + holidays toggle)
//   3. Optional Sleeper import (currently a placeholder — defer per B7)
//
// There was a lock-offset step here. Weeks aren't closed by a clock any
// more — whoever places the bet closes them — so there was nothing left
// for it to configure.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createLeague } from '@/app/actions/leagues'
import { logout } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  Loader2,
  RefreshCw,
  Trophy,
  Cog,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3
const TOTAL_STEPS: Step = 3

interface WizardState {
  name: string
  inviteCode: string
  slateDays: string[]
  includeHolidays: boolean
  // Sleeper import deferred — placeholder only.
  skipSleeper: boolean
}

const STEP_TITLES: Record<Step, string> = {
  1: 'Identity',
  2: 'Slate',
  3: 'Sleeper import',
}

const STEP_EYEBROWS: Record<Step, string> = {
  1: 'Step 1 of 3 · Name your crew',
  2: 'Step 2 of 3 · Pick the slate',
  3: 'Step 3 of 3 · One more thing',
}

const INVITE_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789'
function randomCode(len = 6): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += INVITE_CHARSET[Math.floor(Math.random() * INVITE_CHARSET.length)]
  }
  return out
}

const DAY_CHIPS = [
  { id: 'sun', short: 'Sun' },
  { id: 'mon', short: 'Mon' },
  { id: 'tue', short: 'Tue' },
  { id: 'wed', short: 'Wed' },
  { id: 'thu', short: 'Thu' },
  { id: 'fri', short: 'Fri' },
  { id: 'sat', short: 'Sat' },
] as const


export default function NewLeaguePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<WizardState>(() => ({
    name: '',
    inviteCode: randomCode(),
    slateDays: ['sun', 'mon'],
    includeHolidays: true,
    skipSleeper: true,
  }))

  useEffect(() => {
    if (step === 1) nameRef.current?.focus()
  }, [step])

  const canAdvance = (s: Step): boolean => {
    if (s === 1) {
      return state.name.trim().length >= 3 && /^[a-z0-9]{4,12}$/.test(state.inviteCode)
    }
    if (s === 2) return state.slateDays.length > 0
    return true
  }

  const goBack = () => {
    setError(null)
    if (step === 1) {
      router.push('/')
      return
    }
    setStep((s) => (s - 1) as Step)
  }

  const goNext = async () => {
    setError(null)
    if (!canAdvance(step)) return
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as Step)
      return
    }
    // Final step → submit.
    setSubmitting(true)
    const res = await createLeague({
      name: state.name.trim(),
      inviteCode: state.inviteCode,
      slateDaysIncluded: state.slateDays,
      slateIncludeHolidays: state.includeHolidays,
    })
    if (res.error) {
      setError(res.error)
      setSubmitting(false)
      // Bounce back to step 1 if it's a name/code error.
      if (res.error.toLowerCase().includes('code') || res.error.toLowerCase().includes('name')) {
        setStep(1)
      }
      return
    }
    if (res.leagueId) {
      router.push(`/leagues/${res.leagueId}`)
    }
  }

  return (
    <div className="min-h-[100dvh] ambient-glow">
      <main className="container mx-auto px-4 pt-8 pb-56 max-w-2xl">
        {/* BACK, and OUT. This was the only signed-in screen in the app
            with no header on it, so it had no menu and therefore no way
            to sign out — and it's exactly where somebody who used the
            wrong Google account landed. "Back" went to `/`, which
            redirected them straight here again. The way out was clearing
            cookies. */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.25em] uppercase text-muted-foreground hover:text-neon-blue transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.25em] uppercase text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </form>
        </div>

        {/* Hero */}
        <header className="mt-6 flex items-center gap-3">
          <div className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neon-blue/15 ring-1 ring-neon-blue/40">
            <Trophy className="h-6 w-6 text-neon-blue" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase leading-none text-neon-blue">
              New League
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide leading-none text-neon-blue truncate">
              {STEP_TITLES[step]}
            </h1>
          </div>
        </header>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={cn(
                'h-1 flex-1 rounded-full transition-all',
                n < step
                  ? 'bg-neon-blue'
                  : n === step
                  ? 'bg-neon-blue/80'
                  : 'bg-white/10'
              )}
            />
          ))}
        </div>

        {/* Step body */}
        <section className="mt-8">
          {step === 1 && <Step1 state={state} setState={setState} nameRef={nameRef} />}
          {step === 2 && <Step2 state={state} setState={setState} />}
          {step === 3 && <Step3 state={state} />}
        </section>
      </main>

      {/* Dock — Back / Next-or-Create */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3 sm:px-4 pb-3 pt-2 pointer-events-none"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <div
          className={cn(
            'pointer-events-auto relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
            'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
            'border-white/15'
          )}
        >
          <div className="px-4 pt-2.5">
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue">
              {STEP_EYEBROWS[step]}
            </span>
          </div>

          {error && (
            <div className="mx-3 mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5 mt-2">
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wide uppercase',
                'border border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground transition-colors',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {step === 1 ? 'Home' : 'Back'}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvance(step) || submitting}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2.5',
                'text-sm font-extrabold tracking-wide uppercase',
                'bg-neon-blue text-black neon-glow-blue',
                'transition-transform hover:scale-[1.02]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : step === TOTAL_STEPS ? (
                <>
                  <Trophy className="h-4 w-4" />
                  Create league
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 1: name + invite code ───────────────────────────────────────────

function Step1({
  state,
  setState,
  nameRef,
}: {
  state: WizardState
  setState: (fn: (s: WizardState) => WizardState) => void
  nameRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-2">
          League name
        </p>
        <Input
          ref={nameRef}
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="e.g. Degenerates, Sunday Funday, The Boys"
          maxLength={60}
          className="text-base"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          3–60 characters. You can change this later.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-2">
          Invite code
        </p>
        <div className="flex items-stretch gap-2">
          <Input
            value={state.inviteCode}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                inviteCode: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12),
              }))
            }
            placeholder="e.g. degenz"
            className="font-mono uppercase tracking-widest text-base"
          />
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, inviteCode: randomCode() }))}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-white/30 hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            New
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          4–12 letters/numbers. Share this with friends so they can join.
        </p>
      </div>
    </div>
  )
}

// ─── Step 2: slate config ─────────────────────────────────────────────────

function Step2({
  state,
  setState,
}: {
  state: WizardState
  setState: (fn: (s: WizardState) => WizardState) => void
}) {
  const toggle = (id: string) =>
    setState((s) => ({
      ...s,
      slateDays: s.slateDays.includes(id)
        ? s.slateDays.filter((d) => d !== id)
        : [...s.slateDays, id],
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
        <CalendarDays className="h-4 w-4 shrink-0 mt-0.5 text-neon-blue" />
        <p className="text-sm text-foreground/85">
          Which weekdays count toward your parlay each week. Most leagues run{' '}
          <span className="text-neon-blue font-semibold">Sunday + Monday</span> — pure
          weekend football. Cooler crews include Thursday too.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-2">
          Slate days
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_CHIPS.map((d) => {
            const active = state.slateDays.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(d.id)}
                className={cn(
                  'rounded-lg border h-14 font-mono text-xs font-bold uppercase transition-all',
                  active
                    ? 'border-neon-blue/60 bg-neon-blue/10 text-neon-blue'
                    : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20'
                )}
              >
                {d.short}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-foreground">Holiday games</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Thanksgiving, Black Friday, Christmas Day always count.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, includeHolidays: !s.includeHolidays }))}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
            state.includeHolidays
              ? 'border-neon-blue/60 bg-neon-blue/40'
              : 'border-white/15 bg-white/5'
          )}
          aria-pressed={state.includeHolidays}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
              state.includeHolidays ? 'left-[22px]' : 'left-0.5'
            )}
          />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Sleeper import (placeholder) ─────────────────────────────────

function Step3({ state }: { state: WizardState }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-5">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
          <Cog className="h-3 w-3" />
          Coming soon
        </div>
        <p className="mt-2 text-sm text-foreground/85">
          Import an existing Sleeper league to pre-fill members and pull historical
          standings. We&apos;ll surface this in a follow-up — it&apos;s not blocking
          today.
        </p>
      </div>

      <div className="rounded-lg border border-neon-blue/20 bg-neon-blue/[0.04] px-4 py-4">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue mb-2.5">
          Review
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-foreground font-semibold">{state.name || '—'}</dd>
          <dt className="text-muted-foreground">Invite code</dt>
          <dd className="font-mono uppercase tracking-wider text-neon-blue">
            {state.inviteCode || '—'}
          </dd>
          <dt className="text-muted-foreground">Slate</dt>
          <dd className="text-foreground">
            {state.slateDays.length
              ? state.slateDays.map((d) => d.toUpperCase()).join(' · ')
              : 'None'}
            {state.includeHolidays && (
              <span className="ml-1 text-neon-blue">+ holidays</span>
            )}
          </dd>
        </dl>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Check className="h-3 w-3 text-neon-blue" />
          You&apos;re the league owner.
        </div>
      </div>
    </div>
  )
}
