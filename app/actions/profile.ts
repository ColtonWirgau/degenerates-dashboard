'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { putAvatar } from '@/lib/storage'

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
    // The storage driver picks itself (Vercel Blob when a token exists,
    // inline data URL otherwise) and owns the size rules — see lib/storage.
    const [current] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const result = await putAvatar(userId, avatar, current?.image ?? null)
    if (result.error !== null) return { success: false, error: result.error }
    update.image = result.url
  }

  await db.update(users).set(update).where(eq(users.id, userId))

  revalidatePath('/')
  return { success: true, error: null }
}
