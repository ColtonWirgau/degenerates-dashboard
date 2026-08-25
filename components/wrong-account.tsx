import { logout } from '@/app/actions/auth'
import { LogOut, MailQuestion } from 'lucide-react'

/**
 * SIGNED IN, BUT NOT IN THE LEAGUE.
 *
 * This is almost always one thing: somebody signed in with the wrong
 * email. Two Google accounts, or a magic link opened in a browser that
 * was already somebody's, or the address the invite went to isn't the
 * one they use.
 *
 * They used to be redirected to the league-creation wizard — which is
 * the right screen for an empty database and exactly the wrong one for
 * this, because the wizard is the only signed-in route in the app with
 * no header on it. No header meant no menu, and no menu meant no way to
 * sign out: a person who mistyped which Google account they wanted was
 * stuck on a form to found a second league, with clearing cookies as
 * the only way back.
 *
 * So: say which account they're on, because that's the fact that
 * explains everything, and put the way out on the screen.
 */
export function WrongAccount({ email, leagueName }: { email: string; leagueName?: string }) {
  return (
    <div className="ambient-glow flex min-h-[100dvh] items-center justify-center px-4">
      <div className="glass-card border-primary/25 w-full max-w-md rounded-2xl border px-6 py-8 text-center">
        <MailQuestion className="text-muted-foreground mx-auto h-9 w-9" />

        <h1 className="font-display mt-4 text-3xl leading-none tracking-tight uppercase">
          Wrong account
        </h1>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          You&apos;re signed in as{' '}
          <span className="text-foreground font-semibold break-all">{email}</span>, and
          that address isn&apos;t in {leagueName ? <>{leagueName}</> : 'the league'}.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Sign out and come back with the email your invite went to — or ask the
          commish to send one here.
        </p>

        <form action={logout} className="mt-7">
          <button
            type="submit"
            className="bg-primary text-primary-foreground neon-glow-blue inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-bold tracking-[0.2em] uppercase transition-transform active:scale-[0.98]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
