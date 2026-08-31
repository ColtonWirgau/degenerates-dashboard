/**
 * Put the premiere reel in Vercel Blob and print its URL.
 *
 *   node scripts/upload-gameday.mjs                     # media-source/gameday-2026.mp4
 *   node scripts/upload-gameday.mjs path/to/other.mp4
 *
 * WHY NOT `public/`. Vercel deploys from git, so anything under public/
 * has to be committed — and the encoded reel is 93MB against a 22MB
 * `.git`. That's a permanent 5x on every clone of this repo, forever,
 * for a video the league watches once. Blob keeps it out of history and
 * still serves it from the same CDN with range requests, so scrubbing
 * works.
 *
 * NEEDS `BLOB_READ_WRITE_TOKEN`. Create a Blob store in the Vercel
 * dashboard (Storage → Create → Blob), which injects the token into the
 * deployment automatically; pull a local copy with `vercel env pull
 * .env.local` or paste it in by hand.
 *
 * The upload is multipart, so a dropped connection retries the failed
 * chunk instead of the whole 93MB.
 */
import { createReadStream, statSync } from 'node:fs'
import { basename } from 'node:path'
import { put } from '@vercel/blob'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const source = process.argv[2] ?? 'media-source/gameday-2026.mp4'

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set.\n')
  console.error('  1. Vercel dashboard → Storage → Create → Blob')
  console.error('  2. Connect it to this project')
  console.error('  3. vercel env pull .env.local\n')
  process.exit(1)
}

let bytes
try {
  bytes = statSync(source).size
} catch {
  console.error(`No such file: ${source}`)
  console.error('Encode it first, or pass the path as an argument.')
  process.exit(1)
}

const mb = (bytes / 1024 / 1024).toFixed(1)
console.log(`Uploading ${basename(source)} (${mb}MB) — this takes a minute...`)

// A stable key, no random suffix: the URL goes in an env var and gets
// pasted into a group chat, so it should be the same string every time
// this is re-run rather than a new one to go chase down.
const blob = await put('gameday/ff-gameday-2026.mp4', createReadStream(source), {
  access: 'public',
  contentType: 'video/mp4',
  addRandomSuffix: false,
  allowOverwrite: true,
  multipart: true,
})

console.log(`\nDone.\n\n  ${blob.url}\n`)
console.log('Set it and redeploy:\n')
console.log(`  vercel env add GAMEDAY_VIDEO_URL production`)
console.log(`  (paste the URL above)\n`)
