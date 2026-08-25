/**
 * Turning an address into a point on a map.
 *
 * Nominatim, because it needs no key and this app has none: there's no
 * Google Maps credential in the environment and a draft venue that
 * changes once a year does not justify getting one. It's rate-limited
 * and asks for a real User-Agent, both of which are fine — this runs
 * once, when somebody saves an address, and the result is stored.
 *
 * Best-effort by design. A failed lookup costs the MAP and nothing
 * else: the address text is what every "open in maps" link carries, so
 * the panel still works with no coordinates at all.
 */

export interface GeoPoint {
  lat: number
  lng: number
}

export async function geocode(address: string): Promise<GeoPoint | null> {
  const q = address.trim()
  if (!q) return null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')

    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires identifying the caller.
        'User-Agent': 'degenerates-dashboard (fantasy league draft venue lookup)',
        'Accept-Language': 'en',
      },
      // Don't hold a form submit hostage to someone else's server.
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null

    const body: unknown = await res.json()
    if (!Array.isArray(body) || body.length === 0) return null
    const hit = body[0] as { lat?: string; lon?: string }
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
