// Nuke-from-orbit cookie clearer. Use when the browser has stale
// Auth.js / Supabase cookies that don't match any DB session — typical
// after a `--reset` migration. Hit /api/auth/clear-stale and you'll
// land on /signin with a fresh slate.

import { NextResponse } from 'next/server'

const STALE = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'sb-access-token',
  'sb-refresh-token',
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const res = NextResponse.redirect(new URL('/signin', url.origin))
  for (const name of STALE) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  // Wipe any Supabase project-scoped cookie that starts with `sb-`.
  const all = request.headers.get('cookie') ?? ''
  for (const pair of all.split(';')) {
    const name = pair.split('=')[0]?.trim()
    if (name && name.startsWith('sb-')) {
      res.cookies.set(name, '', { maxAge: 0, path: '/' })
    }
  }
  return res
}
