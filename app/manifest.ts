import type { MetadataRoute } from 'next'

/**
 * THE INSTALL FACE — one manifest, typed, in the app.
 *
 * There used to be three answers to every question here: a hand-written
 * `public/manifest.json`, a second `public/favicon/site.webmanifest`
 * nobody linked, and `app/layout.tsx`'s viewport. They disagreed — the
 * manifest painted the OS chrome electric cyan while the viewport
 * painted it near-black, so the installed app's title bar was a
 * different colour from the page under it.
 *
 * The icons are DD set in Anton, the wordmark's own face. They were a
 * wide geometric sans with round bowls; the wordmark is condensed with
 * flat terminals, and on a home screen next to the app itself they
 * didn't read as the same product. See scripts/render-pwa-art.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Degenerates Dashboard',
    short_name: 'Degenerates',
    description:
      'A 12-leg parlay you all lose together every Sunday. The slate, the legs, the board, and the house rules.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Both the same near-black the canvas actually is, so the splash,
    // any letterboxing and the OS chrome are all one surface. The neon
    // is what's ON the ground, never the ground.
    background_color: '#0A0A0A',
    theme_color: '#0A0A0A',
    categories: ['sports', 'entertainment'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Its own file, at its own scale. The old set declared ONE icon as
      // "any maskable" with the mark running edge to edge, so Android
      // cropped the glow — and iOS, which ignores transparency rules,
      // matted the transparent PNG onto white.
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
    // No shortcuts. The one that was here pointed at /dashboard, which
    // has never been a route in this app — a long-press on the icon
    // offered a link straight to a 404. Every real destination lives
    // under /leagues/{id}, and the id isn't known at build time.
  }
}
