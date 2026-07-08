// Legacy Supabase login page → now bounces to /signin (Auth.js). Kept
// as a redirect so any stale bookmarks / external links / middleware
// callback URLs keep working through the cutover.

import { redirect } from 'next/navigation'

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; callbackUrl?: string }>
}) {
  const { redirectTo, callbackUrl } = await searchParams
  const target = callbackUrl ?? redirectTo
  redirect(target ? `/signin?callbackUrl=${encodeURIComponent(target)}` : '/signin')
}
