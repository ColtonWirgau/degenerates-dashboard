// Legacy Supabase signup page → now bounces to /signin. With Google
// OAuth the same flow handles new + returning users (Auth.js creates
// the user on first sign-in), so there's no separate signup step.

import { redirect } from 'next/navigation'

export default async function LegacySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; callbackUrl?: string }>
}) {
  const { redirectTo, callbackUrl } = await searchParams
  const target = callbackUrl ?? redirectTo
  redirect(target ? `/signin?callbackUrl=${encodeURIComponent(target)}` : '/signin')
}
