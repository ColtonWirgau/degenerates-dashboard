'use client'

// Inline magic-link form for the home-page sign-in dock. On submit:
// - calls the sendMagicLink server action (no redirect)
// - flips into a "Check your inbox" inline state
// - exposes a "use a different email" reset link

import { useActionState, useState } from 'react'
import { cn } from '@/lib/utils'
import { sendMagicLink, type SendMagicLinkResult } from '@/app/actions/auth-magic'

export function MagicLinkForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<
    SendMagicLinkResult | null,
    FormData
  >(sendMagicLink, null)
  const [resetCounter, setResetCounter] = useState(0)

  if (state?.ok) {
    return (
      <div className="text-center py-2 space-y-1">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-neon-pink">
          Check your inbox
        </p>
        <p className="text-sm text-foreground/90">
          Link sent to{' '}
          <span className="text-neon-blue font-semibold">{state.email}</span>
        </p>
        <button
          type="button"
          onClick={() => setResetCounter((c) => c + 1)}
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form
      key={resetCounter}
      action={action}
      className="space-y-1.5"
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/'} />
      <div className="flex items-stretch gap-1.5">
        <input
          type="email"
          name="email"
          required
          disabled={pending}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            'flex-1 min-w-0 rounded-full bg-black/40 border border-white/10 px-4 py-2.5',
            // 16px on mobile to dodge iOS zoom-on-focus; trim back to
            // 14px on sm+ where the dock has more room.
            'text-base sm:text-sm text-foreground placeholder:text-muted-foreground/50',
            'focus:outline-none focus:border-neon-pink/50',
            'disabled:opacity-60'
          )}
        />
        <button
          type="submit"
          disabled={pending}
          className={cn(
            'shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5',
            'text-xs font-extrabold tracking-wide uppercase',
            'bg-white/[0.06] text-neon-pink border border-neon-pink/30',
            'hover:bg-neon-pink/15 transition-colors',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {pending ? 'Sending…' : 'Email link'}
        </button>
      </div>
      {state?.error && (
        <p className="text-[10px] text-neon-pink/90 text-center px-1">
          {state.error}
        </p>
      )}
    </form>
  )
}
