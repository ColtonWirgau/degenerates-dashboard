// Landing page after submitting the magic-link email form. Auth.js
// redirects here automatically (configured via pages.verifyRequest in
// auth.ts). Just tells the user to check their email and click the link.

import Link from 'next/link'

export default function VerifyRequestPage() {
  return (
    <div className="min-h-[100dvh] ambient-glow flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center space-y-6">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-neon-pink">
          Check your inbox
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          <span className="text-neon-blue">Link sent.</span>
        </h1>
        <p className="text-sm text-foreground/80 leading-relaxed">
          We just emailed you a sign-in link. Click it from any device and you&apos;re
          in — no password to remember, no group-text Venmo guilt.
        </p>
        <p className="text-xs text-muted-foreground italic">
          Didn&apos;t get it? Check spam, double-check the address, or just{' '}
          <Link href="/" className="text-neon-blue underline hover:text-neon-blue/80">
            try again
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
