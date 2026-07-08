'use server'

// Server action wrapper around Auth.js's Nodemailer (Brevo) sign-in.
// Default Auth.js flow throws a Next.js redirect on success (lands the
// browser on `/verify-request`). We pass `redirect: false` so it
// returns instead, letting the client render the "Check your inbox"
// state inline.

import { signIn } from '@/auth'

export interface SendMagicLinkResult {
  ok: boolean
  email: string
  error: string | null
}

export async function sendMagicLink(
  _prev: SendMagicLinkResult | null,
  formData: FormData
): Promise<SendMagicLinkResult> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  if (!email) {
    return { ok: false, email, error: 'Email is required' }
  }
  const callbackUrl =
    (formData.get('callbackUrl') as string | null) || '/'
  try {
    await signIn('nodemailer', {
      email,
      redirectTo: callbackUrl,
      redirect: false,
    })
    return { ok: true, email, error: null }
  } catch (err) {
    return {
      ok: false,
      email,
      error: err instanceof Error ? err.message : 'Failed to send link',
    }
  }
}
