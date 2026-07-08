// /signin used to be the dedicated Auth.js sign-in page. Sign-in now
// lives inline on the home page, so this route just redirects there
// (preserving callbackUrl + error query params so OAuth round-trips
// still land correctly).

import { redirect } from 'next/navigation'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  if (sp.callbackUrl) params.set('callbackUrl', sp.callbackUrl)
  if (sp.error) params.set('error', sp.error)
  const qs = params.toString()
  redirect(qs ? `/?${qs}` : '/')
}
