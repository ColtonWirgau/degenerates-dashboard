import { NextResponse, type NextRequest } from 'next/server'

// Auth.js v5 session-cookie names. The `__Secure-` prefix is used on
// https deployments (Vercel prod); dev / preview can hit the un-prefixed
// variant. Either being present means "this user has a session in their
// browser" — the actual validity check happens server-side when a page
// calls `auth()`.
const AUTHJS_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

const PROTECTED_PREFIXES = ['/dashboard', '/leagues', '/profile']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const hasAuthCookie = AUTHJS_COOKIES.some((name) => request.cookies.has(name))
  if (hasAuthCookie) return NextResponse.next()

  // Optimistic: cookie presence is enough to let through. Real validation
  // happens in the page's `auth()` call — if the cookie is stale (e.g.
  // the sessions row was wiped), that path renders the unauthenticated
  // state correctly.
  //
  // No cookie at all → send them to the home sign-in dock with a
  // callbackUrl that returns them here after sign-in.
  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
