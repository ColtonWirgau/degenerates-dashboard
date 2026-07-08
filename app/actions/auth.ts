'use server'

// All "real" sign-in is on the home page (Google OAuth + magic-link via
// Auth.js). This file used to host legacy Supabase password login /
// signup actions; those went away with the Supabase decom. Only the
// logout shim remains, kept so existing forms / menus that wire to it
// keep working.

import { revalidatePath } from 'next/cache'
import { signOut } from '@/auth'

export async function logout() {
  await signOut({ redirectTo: '/' })
  revalidatePath('/', 'layout')
}
