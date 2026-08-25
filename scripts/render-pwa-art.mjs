/**
 * Renders the PWA's faces — home-screen icons and iOS launch images —
 * through a headless browser pointed at the running dev server, so the
 * type in them is the SAME Anton the app ships (next/font, self-hosted)
 * rather than a lookalike. The old set was drawn in a wide geometric
 * sans with round bowls; the wordmark is condensed with flat terminals,
 * and side by side they didn't read as the same product.
 *
 *   npm run dev            # must be up on :3001 (Anton is served there)
 *   node scripts/render-pwa-art.mjs
 *
 * Everything is emitted to public/. Re-run after a brand change.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3001'
const OUT = new URL('../public/', import.meta.url).pathname

const BG = '#0A0A0A'
const BLUE = '#00D9FF'
const PINK = '#FF69B4'

/** The canvas the app itself sits on: near-black under a neon wash. */
const wash = `
  radial-gradient(ellipse at 22% 26%, rgba(0,217,255,0.20) 0%, transparent 52%),
  radial-gradient(ellipse at 78% 20%, rgba(0,217,255,0.12) 0%, transparent 46%),
  radial-gradient(ellipse at 40% 84%, rgba(255,105,180,0.16) 0%, transparent 52%)
`

/**
 * The mark: DD, the wordmark's two initials in its two colours, set in
 * Anton. `scale` is the cap height as a fraction of the shorter side —
 * maskable icons keep everything inside the inner 80% circle, so they
 * ask for a smaller number than the plain one does.
 */
function markHtml({ w, h, scale, glow = true }) {
  const size = Math.round(Math.min(w, h) * scale)
  const blur = Math.round(size * 0.13)
  return `
  <div style="
    width:${w}px;height:${h}px;background-color:${BG};background-image:${wash.replace(/\s+/g, ' ')};
    display:flex;align-items:center;justify-content:center;overflow:hidden;">
    <div style="
      font-family:var(--font-anton),'Anton',sans-serif;
      font-size:${size}px;line-height:0.78;letter-spacing:-0.02em;
      display:flex;align-items:baseline;">
      <span style="color:${BLUE};${glow ? `text-shadow:0 0 ${blur}px rgba(0,217,255,0.75), 0 0 ${blur * 2}px rgba(0,217,255,0.35);` : ''}">D</span><span
            style="color:${PINK};${glow ? `text-shadow:0 0 ${blur}px rgba(255,105,180,0.75), 0 0 ${blur * 2}px rgba(255,105,180,0.35);` : ''}">D</span>
    </div>
  </div>`
}

/**
 * The launch image iOS shows before the first paint. Same canvas, and
 * the FULL stacked lockup — this is the frame people stare at while the
 * app boots, so it says the app's whole name, not its initials.
 */
function splashHtml({ w, h }) {
  const size = Math.round(w * 0.155)
  const blur = Math.round(size * 0.5)
  return `
  <div style="
    width:${w}px;height:${h}px;background-color:${BG};background-image:${wash.replace(/\s+/g, ' ')};
    display:flex;align-items:center;justify-content:center;">
    <div style="
      font-family:var(--font-anton),'Anton',sans-serif;
      font-size:${size}px;line-height:0.82;letter-spacing:-0.02em;
      display:flex;flex-direction:column;align-items:center;text-align:center;">
      <span style="color:${BLUE};text-shadow:0 0 ${blur}px rgba(0,217,255,0.55);">DEGENERATES</span>
      <span style="color:${PINK};text-shadow:0 0 ${blur}px rgba(255,105,180,0.55);">DASHBOARD</span>
    </div>
  </div>`
}

/** iPhone sizes iOS actually matches against, newest first. */
const SPLASHES = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
]

const ICONS = [
  { file: 'icon-192.png', w: 192, h: 192, scale: 0.62 },
  { file: 'icon-512.png', w: 512, h: 512, scale: 0.62 },
  // Maskable: platforms crop to a circle/squircle inscribed in the
  // middle 80%, so the mark has to live well inside that.
  { file: 'icon-maskable-512.png', w: 512, h: 512, scale: 0.44 },
  { file: 'apple-touch-icon.png', w: 180, h: 180, scale: 0.62 },
  { file: 'favicon-32x32.png', w: 32, h: 32, scale: 0.72, glow: false },
  { file: 'favicon-16x16.png', w: 16, h: 16, scale: 0.8, glow: false },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
// Land on the app first so next/font's --font-anton is defined and the
// face is already fetched; then paint into the same document.
await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

async function shoot(html, w, h, outPath) {
  await page.setViewportSize({ width: w, height: h })
  await page.evaluate((markup) => {
    document.body.style.margin = '0'
    document.body.innerHTML = `<div id="art">${markup}</div>`
  }, html)
  await page.evaluate(() => document.fonts.ready)
  const buf = await page.locator('#art').screenshot({ omitBackground: false })
  writeFileSync(outPath, buf)
  console.log('wrote', outPath.replace(OUT, 'public/'))
}

mkdirSync(join(OUT, 'favicon'), { recursive: true })
mkdirSync(join(OUT, 'pwa-splash'), { recursive: true })

for (const i of ICONS) {
  const html = markHtml({ w: i.w, h: i.h, scale: i.scale, glow: i.glow })
  await shoot(html, i.w, i.h, join(OUT, i.file))
  // Keep the legacy /favicon/* paths populated too — the old markup
  // and any bookmarked URLs still point at them.
  if (i.file.startsWith('favicon-') || i.file === 'apple-touch-icon.png') {
    await shoot(html, i.w, i.h, join(OUT, 'favicon', i.file))
  }
}
// The android-chrome names the old manifest used, so nothing 404s.
await shoot(markHtml({ w: 192, h: 192, scale: 0.62 }), 192, 192, join(OUT, 'favicon/android-chrome-192x192.png'))
await shoot(markHtml({ w: 512, h: 512, scale: 0.62 }), 512, 512, join(OUT, 'favicon/android-chrome-512x512.png'))

for (const [w, h, r] of SPLASHES) {
  await shoot(splashHtml({ w: w * r, h: h * r }), w * r, h * r, join(OUT, `pwa-splash/${w}x${h}@${r}x.png`))
}

/**
 * favicon.ico, built by hand — every ICO since Vista may embed PNGs
 * directly, so the container is a 6-byte directory header plus one
 * 16-byte entry per size, then the PNG bytes verbatim. Beats adding an
 * image dependency for a file that changes once a brand.
 */
function ico(pngs) {
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // 1 = icon
  dir.writeUInt16LE(pngs.length, 4)
  let offset = 6 + pngs.length * 16
  const entries = []
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // palette
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bpp
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(e)
  }
  return Buffer.concat([dir, ...entries, ...pngs.map((p) => p.data)])
}

const icoSizes = []
for (const size of [16, 32, 48]) {
  await page.setViewportSize({ width: size, height: size })
  await page.evaluate((markup) => {
    document.body.style.margin = '0'
    document.body.innerHTML = `<div id="art">${markup}</div>`
  }, markHtml({ w: size, h: size, scale: size <= 16 ? 0.8 : 0.72, glow: false }))
  await page.evaluate(() => document.fonts.ready)
  icoSizes.push({ size, data: await page.locator('#art').screenshot() })
}
const icoBuf = ico(icoSizes)
// public/, NOT app/. Next DECODES an app/favicon.ico to build its
// metadata, and its Rust decoder rejects a PNG-in-ICO that isn't RGBA —
// which a screenshot of an opaque canvas never is. From public/ it's
// served as bytes, and app/icon.png supplies the <link rel="icon">.
writeFileSync(join(OUT, 'favicon.ico'), icoBuf)
writeFileSync(join(OUT, 'favicon/favicon.ico'), icoBuf)
console.log('wrote public/favicon.ico + public/favicon/favicon.ico')

await browser.close()
console.log('done')
