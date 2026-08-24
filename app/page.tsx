import { redirect } from 'next/navigation'
import { signIn } from '@/auth'
import { getLeagues } from '@/app/actions/leagues'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { MagicLinkForm } from '@/components/magic-link-form'
import { cn } from '@/lib/utils'

const OAUTH_ERROR_COPY: Record<string, string> = {
  OAuthAccountNotLinked:
    'That email already has an account from a different provider. Sign in the way you signed up the first time, or ask the commish to merge it.',
  AccessDenied: 'You denied the Google permissions. Try again and click Allow.',
  Default: 'Sign-in failed. Try again.',
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const me = await getCurrentUser()

  if (me) {
    // Single-tenant: there is one league, and it IS the app. Signed-in
    // members go straight in; the create wizard is only for the very
    // first run (an empty database).
    const { leagues } = await getLeagues()
    if (leagues.length > 0) {
      redirect(`/leagues/${leagues[0].id}`)
    }
    redirect('/leagues/new')
  }

  const { error, callbackUrl } = await searchParams
  const errorMessage = error
    ? OAUTH_ERROR_COPY[error] ?? OAUTH_ERROR_COPY.Default
    : null

  return (
    <div className="min-h-[100dvh] ambient-glow">
      <main className="container mx-auto px-4 pt-16 sm:pt-24 pb-56 max-w-4xl">
        {/* Hero */}
        <section className="text-center">
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground">
            Fantasy league HR department
          </p>
          <h1 className="mt-3 text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-none">
            <span className="block text-neon-blue">Degenerates</span>
            <span className="block text-neon-pink mt-1">Dashboard</span>
          </h1>
          <p className="mt-6 text-sm sm:text-base text-muted-foreground italic">
            A 12-leg parlay you all lose together every Sunday.
          </p>
        </section>

        {/* What this thing actually is — the 12-grown-men headline + a
            broader sweep of what it does. */}
        <section className="mt-14 sm:mt-20 max-w-2xl mx-auto space-y-5 text-center">
          <p className="text-base sm:text-lg text-foreground/85 leading-relaxed">
            Getting <span className="text-neon-pink font-semibold">12 grown men</span>{' '}
            to agree on one draft date without one of them getting killed by his wife.
          </p>
          <p className="text-base sm:text-lg text-foreground/80 leading-relaxed">
            Vote on the rules. Lock the dates. Settle the punishment.{' '}
            <span className="text-neon-blue">Track the parlay.</span>
          </p>
        </section>
      </main>

      {/* Dock — inline Google sign-in. Auth.js handles new + returning
          users in one flow, so there's no separate signup step. Form
          submits to the Auth.js server action directly; no /signin
          redirect detour. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3 sm:px-4 pb-3 pt-2 pointer-events-none"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <div
          className={cn(
            'pointer-events-auto relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
            'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent'
          )}
        >
          <div className="px-4 pt-2.5 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue">
              Punch in
            </span>
            {errorMessage && (
              <span className="text-[10px] text-neon-pink leading-tight max-w-[60%] text-right">
                {errorMessage}
              </span>
            )}
          </div>
          <div className="px-3 py-2.5 pt-2 space-y-2.5">
            {/* Google OAuth — one click */}
            <form
              action={async () => {
                'use server'
                await signIn('google', { redirectTo: callbackUrl ?? '/' })
              }}
            >
              <button
                type="submit"
                className={cn(
                  'flex w-full items-center justify-center gap-3 rounded-full px-5 py-3',
                  'text-sm font-extrabold tracking-wide uppercase',
                  'bg-neon-blue text-black neon-glow-blue',
                  'transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-neon-blue/40'
                )}
              >
                <GoogleIcon className="h-4 w-4" />
                Sign in with Google
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 px-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Magic-link email form — client component swaps to a
                "Check your inbox" state inline (no /verify-request
                redirect). */}
            <MagicLinkForm callbackUrl={callbackUrl} />

            <p className="text-center text-[9px] uppercase tracking-[0.3em] text-muted-foreground/55">
              By signing in you agree to be a degenerate.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline Google glyph so we don't add an icon dep for one mark.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#000" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.98 10.98 0 0 0 12 23z" fill="#000" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.98 10.98 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#000" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#000" />
    </svg>
  )
}
