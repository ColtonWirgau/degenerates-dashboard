// Where uploaded files live.
//
// Driver seam rather than a direct call, because the answer changed once
// already and will change again: avatars started as base64 data URLs in
// `users.image` (fine for 12 people, awful for anything bigger), and the
// real home is Vercel Blob — same platform this app deploys to, so the
// token is injected for us in production and there is no bucket policy,
// IAM user, or CORS rule to keep in sync.
//
// The inline driver stays as the automatic fallback so the feature keeps
// working before a Blob store exists (and in local dev without a token).
// Swapping in S3 later means adding one branch here, nothing else.

import { del, put } from '@vercel/blob'

export type StorageDriver = 'vercel-blob' | 'inline'

/** Inline data URLs ride along on every session read — keep them tiny. */
const INLINE_MAX_BYTES = 150 * 1024
/** With real storage we can accept what the client already allows. */
const BLOB_MAX_BYTES = 2 * 1024 * 1024

export function activeDriver(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'inline'
}

export function maxUploadBytes(): number {
  return activeDriver() === 'vercel-blob' ? BLOB_MAX_BYTES : INLINE_MAX_BYTES
}

export type PutResult = { url: string; error: null } | { url: null; error: string }

function extensionFor(file: File): string {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  const fromType = file.type.split('/')[1]?.toLowerCase()
  return fromType && /^[a-z0-9]{2,5}$/.test(fromType) ? fromType : 'jpg'
}

/**
 * Store a user's avatar and return its URL. `previousUrl` is deleted when
 * it was one of ours — otherwise every re-upload leaks a blob forever.
 */
export async function putAvatar(
  userId: string,
  file: File,
  previousUrl?: string | null
): Promise<PutResult> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Avatar must be an image file' }
  }
  const limit = maxUploadBytes()
  if (file.size > limit) {
    const mb = Math.round((limit / (1024 * 1024)) * 10) / 10
    const kb = Math.round(limit / 1024)
    return {
      url: null,
      error:
        limit >= 1024 * 1024
          ? `Image too large — keep it under ${mb}MB`
          : `Image too large — keep it under ${kb}KB`,
    }
  }

  if (activeDriver() === 'vercel-blob') {
    try {
      // Timestamped path: Blob URLs are immutable + cached, so reusing a
      // key would serve the old face until the CDN caught up.
      const key = `avatars/${userId}-${Date.now()}.${extensionFor(file)}`
      const blob = await put(key, file, {
        access: 'public',
        contentType: file.type,
      })
      if (previousUrl) void deleteIfOurs(previousUrl)
      return { url: blob.url, error: null }
    } catch (err) {
      console.error('[storage] blob upload failed:', err)
      return { url: null, error: 'Upload failed — try again' }
    }
  }

  const buf = Buffer.from(await file.arrayBuffer())
  return { url: `data:${file.type};base64,${buf.toString('base64')}`, error: null }
}

/** Best-effort cleanup; a failed delete must never fail the save. */
async function deleteIfOurs(url: string): Promise<void> {
  if (!url.includes('.public.blob.vercel-storage.com')) return
  try {
    await del(url)
  } catch (err) {
    console.warn('[storage] blob delete failed (orphaned):', err)
  }
}
