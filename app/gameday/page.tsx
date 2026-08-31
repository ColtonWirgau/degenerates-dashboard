/**
 * THE PREMIERE — one video, one night, one link.
 *
 * Deliberately outside `/leagues`, which means outside the canvas shell
 * and outside `middleware.ts`'s auth gate. The link gets dropped in the
 * group chat at kickoff and has to open on the first tap, on whatever
 * phone, signed in or not. A sign-in wall between a man and a nine
 * minute joke video is how you lose the room.
 *
 * Unlisted rather than public: `noindex` keeps it out of search, and
 * nothing in the app links here. You have to be handed the URL.
 *
 * The file itself does NOT live in this repo. It's 93MB after encoding,
 * and `.git` is 22MB — committing it would quintuple every clone this
 * league's app ever gets, forever, for a video that gets watched once.
 * It lives in Vercel Blob (see `scripts/upload-gameday.mjs`) and arrives
 * here as a URL. `lib/storage.ts` already calls Blob "the real home" for
 * uploads; this is the same answer for a much bigger file.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * Read the URL per request, not at build.
 *
 * This page has no dynamic API in it, so Next happily prerenders it —
 * which BAKES IN whatever `GAMEDAY_VIDEO_URL` was at build time. Setting
 * the variable in Vercel afterwards would change nothing until the next
 * deploy, and the failure shows up as "No reel loaded" at the exact
 * moment eleven people are tapping the link. A page that gets five
 * lifetime views has nothing to gain from static generation and one very
 * bad way to lose.
 */
export const dynamic = 'force-dynamic'

/** Where the encoded MP4 actually lives. Set by `scripts/upload-gameday.mjs`. */
const POSTER = '/media/gameday-2026-poster.jpg'
const RUNTIME = '9:15'

export const metadata: Metadata = {
  title: 'FF Gameday 2026',
  description: 'Nine minutes. One time. Do not watch this at work.',
  // Unlisted, not secret — but there's no reason for it to be indexed.
  robots: { index: false, follow: false },
  // The link gets pasted into a group chat, so the unfurl is the first
  // thing eleven people see. Give it the cold-open frame.
  openGraph: {
    title: 'FF GAMEDAY 2026',
    description: 'Nine minutes. One time. Do not watch this at work.',
    images: [{ url: POSTER, width: 1280, height: 720 }],
    type: 'video.other',
  },
  twitter: { card: 'summary_large_image', images: [POSTER] },
}

export default function GamedayPage() {
  const videoUrl = process.env.GAMEDAY_VIDEO_URL ?? ''

  return (
    <div className="ambient-glow min-h-[100dvh]">
      <main className="mx-auto flex max-w-5xl flex-col px-4 pt-10 pb-16 sm:pt-16">
        <header className="text-center">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase sm:text-[11px]">
            Degenerates Dashboard presents
          </p>
          <h1 className="mt-3 text-4xl leading-[0.95] font-bold tracking-tight sm:text-6xl md:text-7xl">
            <span className="text-neon-blue block">FF Gameday</span>
            <span className="text-neon-pink mt-1 block">2026</span>
          </h1>

          {/* The marquee facts, in the tabular voice the rest of the app
              uses for numbers. */}
          <div className="text-muted-foreground/70 mt-5 flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.18em] uppercase sm:gap-3 sm:text-[11px]">
            <span className="tabular-nums">{RUNTIME}</span>
            <span aria-hidden className="text-neon-blue/40">
              ·
            </span>
            <span>Sound on</span>
            <span aria-hidden className="text-neon-blue/40">
              ·
            </span>
            <span>Watch once</span>
          </div>
        </header>

        {/* THE SCREEN. Aspect-locked so the page doesn't reflow when the
            metadata lands, and `bg-black` under it so letterboxing on a
            non-16:9 phone reads as a screen rather than as a gap. */}
        <section className="mt-8 sm:mt-10">
          {videoUrl ? (
            <div className="neon-glow-blue border-neon-blue/25 overflow-hidden rounded-2xl border bg-black shadow-2xl">
              <video
                controls
                playsInline
                // No autoplay: it's 93MB and phones are on cell data.
                // `metadata` gets the duration and the scrubber without
                // pulling the file until someone actually presses play.
                preload="metadata"
                poster={POSTER}
                controlsList="nodownload"
                className="aspect-video h-auto w-full bg-black"
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser can&apos;t play this one.{' '}
                <a href={videoUrl} className="text-neon-blue underline">
                  Open the file directly.
                </a>
              </video>
            </div>
          ) : (
            <NotWiredYet />
          )}
        </section>

        <p className="text-muted-foreground/60 mt-6 text-center text-xs italic sm:text-sm">
          Tap the fullscreen button. You earned this.
        </p>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-muted-foreground/60 hover:text-neon-blue text-[10px] font-bold tracking-[0.22em] uppercase transition-colors"
          >
            ← Back to the dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}

/**
 * Only the commissioner should ever see this, and only before the
 * upload. It says what to run rather than "something went wrong",
 * because the person looking at it is the person who can fix it.
 */
function NotWiredYet() {
  return (
    <div className="border-neon-pink/30 bg-neon-pink/[0.04] rounded-2xl border border-dashed p-8 text-center sm:p-12">
      <p className="text-neon-pink text-[11px] font-bold tracking-[0.3em] uppercase">
        No reel loaded
      </p>
      <p className="text-muted-foreground mt-3 text-sm">
        <code className="text-foreground/80">GAMEDAY_VIDEO_URL</code> isn&apos;t set.
        Upload the encoded file, then put the URL it prints into the Vercel
        environment.
      </p>
      <code className="text-muted-foreground/70 mt-4 block text-xs break-all">
        node scripts/upload-gameday.mjs
      </code>
    </div>
  )
}
