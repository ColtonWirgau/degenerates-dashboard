'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')

  // Check for invite token
  const inviteToken = formData.get('invite') as string
  if (inviteToken) {
    redirect(`/invite/${inviteToken}`)
  }

  // Check for league join code
  const joinCode = formData.get('join') as string
  if (joinCode) {
    redirect(`/join/${joinCode}`)
  }

  // Check if there's a redirect URL
  const redirectTo = formData.get('redirectTo') as string
  if (redirectTo && redirectTo.startsWith('/')) {
    redirect(redirectTo)
  }

  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
      },
    },
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')

  // Check for invite token
  const inviteToken = formData.get('invite') as string
  if (inviteToken) {
    redirect(`/invite/${inviteToken}`)
  }

  // Check for league join code
  const joinCode = formData.get('join') as string
  if (joinCode) {
    redirect(`/join/${joinCode}`)
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
