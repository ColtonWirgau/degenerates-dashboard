'use server'

import { revalidatePath } from 'next/cache'

export async function updateProfile(_formData: FormData) {
  console.warn('[mock] updateProfile no-op')
  revalidatePath('/profile')
  return { success: true, error: null }
}
