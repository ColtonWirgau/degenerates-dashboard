/**
 * THE PLAYER CATALOG — pulling Sleeper's, and searching ours.
 *
 * Sleeper publishes the whole NFL as one ~10MB JSON document with no key
 * required. It's the same source Dynastly uses, and the id it hands back
 * is the id that builds the headshot URL, so one sync buys both the
 * lookup and the face.
 *
 * The fetch is far too big to do per request, so it lands in a table and
 * a script re-runs it. Rosters move in a week; a catalog a few days stale
 * is a wrong team abbreviation next to a right name, which is a much
 * smaller problem than a ten-megabyte download on someone's phone.
 */

import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { nflPlayers } from '@/db/schema'

const SLEEPER_CATALOG = 'https://api.sleeper.app/v1/players/nfl'

/** The positions a fantasy league actually drafts. */
const KEPT_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'])

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

/**
 * The form a name is matched on.
 *
 * Lowercased, punctuation gone, generational suffix dropped — so
 * "Marvin Harrison Jr." and "marvin harrison" are the same key. Sleeper
 * itself is inconsistent about the suffix, which is exactly why the
 * comparison can't include it.
 */
export function normalizeName(name: string): string {
  const parts = name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1]!)) parts.pop()
  return parts.join(' ')
}

/** The headshot, from the id. Sleeper 404s for players it has no photo
 *  of, so every caller needs a fallback. */
export function headshotUrl(sleeperId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`
}

type SleeperPlayer = {
  player_id?: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  position?: string | null
  team?: string | null
  number?: number | null
  active?: boolean
}

export interface SyncResult {
  fetched: number
  kept: number
}

/**
 * Pull the catalog and replace ours with it.
 *
 * Active, drafted-position players only. The raw document carries every
 * practice-squad body and everybody who has retired since 2017 — about
 * 11,000 rows — and a search box that offers a running back who left the
 * league in 2019 is worse than one that offers nothing.
 */
export async function syncNflPlayers(): Promise<SyncResult> {
  const res = await fetch(SLEEPER_CATALOG)
  if (!res.ok) throw new Error(`Sleeper catalog fetch failed: ${res.status}`)
  const raw = (await res.json()) as Record<string, SleeperPlayer>
  const all = Object.values(raw)

  const rows = all
    .filter(
      (p) =>
        p.player_id &&
        p.active &&
        p.position &&
        KEPT_POSITIONS.has(p.position) &&
        (p.full_name || p.last_name)
    )
    .map((p) => {
      const fullName =
        p.full_name?.trim() ||
        `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
      return {
        sleeperId: p.player_id!,
        fullName,
        searchName: normalizeName(fullName),
        position: p.position!,
        team: p.team ?? null,
        number: typeof p.number === 'number' ? p.number : null,
      }
    })

  // Upsert rather than truncate-and-fill: keeper rows point at these ids,
  // and a table that's empty for the half-second between the delete and
  // the insert is a page with no headshots on it.
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(nflPlayers)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: nflPlayers.sleeperId,
        set: {
          fullName: sql`excluded.full_name`,
          searchName: sql`excluded.search_name`,
          position: sql`excluded.position`,
          team: sql`excluded.team`,
          number: sql`excluded.number`,
          updatedAt: new Date(),
        },
      })
  }

  return { fetched: all.length, kept: rows.length }
}

export interface PlayerHit {
  sleeperId: string
  fullName: string
  position: string
  team: string | null
}

/**
 * Find a player by what somebody has typed so far.
 *
 * Prefix matches first, then anything containing the term — typing
 * "jefferson" should reach Justin Jefferson, but typing "just" should
 * reach him before it reaches anybody merely named Justin.
 */
export async function searchNflPlayers(query: string, limit = 8): Promise<PlayerHit[]> {
  const q = normalizeName(query)
  if (q.length < 2) return []

  const rows = await db
    .select({
      sleeperId: nflPlayers.sleeperId,
      fullName: nflPlayers.fullName,
      position: nflPlayers.position,
      team: nflPlayers.team,
    })
    .from(nflPlayers)
    .where(
      or(ilike(nflPlayers.searchName, `${q}%`), ilike(nflPlayers.searchName, `%${q}%`))
    )
    // Prefix hits before substring hits, then alphabetical — a stable
    // order matters more than a clever one when you're arrowing down a
    // list.
    .orderBy(
      sql`case when ${nflPlayers.searchName} like ${q + '%'} then 0 else 1 end`,
      nflPlayers.fullName
    )
    .limit(limit)

  return rows
}

/** One catalog entry, by Sleeper's id — what the picker sends back. */
export async function playerById(sleeperId: string): Promise<PlayerHit | null> {
  const rows = await db
    .select({
      sleeperId: nflPlayers.sleeperId,
      fullName: nflPlayers.fullName,
      position: nflPlayers.position,
      team: nflPlayers.team,
    })
    .from(nflPlayers)
    .where(eq(nflPlayers.sleeperId, sleeperId))
    .limit(1)
  return rows[0] ?? null
}

/** The catalog entry for an exact name, when there is exactly one. */
export async function resolvePlayer(
  name: string,
  position?: string | null
): Promise<PlayerHit | null> {
  const q = normalizeName(name)
  if (!q) return null
  const rows = await db
    .select({
      sleeperId: nflPlayers.sleeperId,
      fullName: nflPlayers.fullName,
      position: nflPlayers.position,
      team: nflPlayers.team,
    })
    .from(nflPlayers)
    .where(
      position
        ? and(eq(nflPlayers.searchName, q), eq(nflPlayers.position, position))
        : eq(nflPlayers.searchName, q)
    )
    .limit(2)
  // Two players share the name — no resolution is better than the wrong
  // headshot on somebody's keeper.
  return rows.length === 1 ? rows[0]! : null
}
