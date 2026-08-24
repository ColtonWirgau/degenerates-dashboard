'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Avatars are stored inline as data URLs for now (12 users, tiny images).
// The client caps uploads at 2MB; the server re-encodes and caps harder —
// a data URL rides along on every session read. Proper blob storage
// (Vercel Blob) is the follow-up if anyone actually hits this.
const MAX_AVATAR_BYTES = 150 * 1024

export async function updateProfile(formData: FormData) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { success: false, error: 'Unauthorized' }

  const fullName = String(formData.get('full_name') ?? '').trim()
  if (fullName.length < 1) return { success: false, error: 'Name cannot be empty' }
  if (fullName.length > 80) return { success: false, error: 'Name is too long (80 char max)' }

  const update: { name: string; image?: string } = { name: fullName }

  const avatar = formData.get('avatar')
  if (avatar instanceof File && avatar.size > 0) {
    if (!avatar.type.startsWith('image/')) {
      return { success: false, error: 'Avatar must be an image file' }
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return {
        success: false,
        error: 'Image too large — use a smaller image (≤150KB) for now',
      }
    }
    const buf = Buffer.from(await avatar.arrayBuffer())
    update.image = `data:${avatar.type};base64,${buf.toString('base64')}`
  }

  await db.update(users).set(update).where(eq(users.id, userId))

  revalidatePath('/')
  return { success: true, error: null }
}
