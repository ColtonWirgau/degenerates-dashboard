// Auth.js v5 config. Single Google provider, Drizzle adapter against
// our Neon instance, database session strategy (we have a sessions
// table, no JWT roundtripping).
//
// Used by:
//   - app/api/auth/[...nextauth]/route.ts (the Next.js handlers)
//   - Server actions / route handlers calling `auth()` to read the session
//   - Server-side `signIn` / `signOut` actions

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/db/client'
import { accounts, sessions, users, verificationTokens } from '@/db/schema'

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      // Auth.js v5 auto-picks up AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET; we
      // pass them explicitly so older AUTH_PROVIDER_* envs (or the
      // long-named GOOGLE_CLIENT_ID alternative) work too.
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
      // Without this, Auth.js refuses to attach a Google account to an
      // existing user that was created some other way (e.g. migrated
      // from Supabase) — even when the emails match — and throws
      // OAuthAccountNotLinked. Google verifies email ownership before
      // returning it to us, so trusting that link is safe for our use
      // case (vs an OAuth provider that allows unverified emails).
      allowDangerousEmailAccountLinking: true,
    }),
    Nodemailer({
      // Magic-link sign-in via Brevo's SMTP relay. Brevo's free tier
      // gives 300 emails/day on a verified custom domain — plenty for
      // a 12-person league.
      //
      // Required env vars:
      //   BREVO_SMTP_USER — your Brevo SMTP login (the email shown
      //     under SMTP & API → SMTP, not the key itself)
      //   BREVO_SMTP_KEY — the SMTP key you generate in that same tab
      //   EMAIL_FROM — sender, e.g. 'hello@degeneratesdashboard.app'
      //     (must be on a Brevo-verified domain)
      server: {
        host: process.env.BREVO_SMTP_HOST ?? 'smtp-relay.brevo.com',
        port: parseInt(process.env.BREVO_SMTP_PORT ?? '587', 10),
        auth: {
          user: process.env.BREVO_SMTP_USER!,
          pass: process.env.BREVO_SMTP_KEY!,
        },
      },
      from: process.env.EMAIL_FROM ?? 'hello@degeneratesdashboard.app',
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    // Sign-in form lives on the home page now (no dedicated route).
    signIn: '/',
    // "Check your email" landing page after a magic-link request.
    verifyRequest: '/verify-request',
  },
  callbacks: {
    // Surface the user id on the session so server actions can grab it
    // without an extra `users` lookup.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
