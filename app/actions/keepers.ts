'use server'

/**
 * KEEPERS — declaring one, amending it, withdrawing it.
 *
 * Everything about how keepers WORK lives in the charter and is voted
 * on: how many slots, what one costs, how long you can hold a player,
 * when declarations shut. This file is the other half — the records
 * those rules govern — and it reads the rules rather than restating
 * them, so a league that votes itself two slots gets two slots without
 * anybody touching this code.
 *
 * Your keeper is YOURS. A commissioner can withdraw one (somebody
 * declares an ineligible player and won't fix it) but cannot declare on
 * your behalf, because a keeper you didn't choose isn't a keeper, it's
 * a mistake with your name on it.
 */

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDevNow } from '@/lib/data/dev-now'
import type { CharterEntry } from '@/lib/data/mock-charter'

export interface KeeperResult {
  success: boolean
  error: string | null
}

/**
 * When declarations shut.
 *
 * The draft itself, from `draft-date`. The charter's own
 * `keeper-deadline` row is free text — "24h before draft" — and parsing
 * a rule out of prose to enforce it would be guessing at what a league
 * meant. So the hard gate is the draft, which is unambiguous, and the
 * declaration deadline stays what it is: something the league tells each
 * other, printed on the page.
 *
 * No date on the books means no gate. A league that hasn't settled when
 * it's drafting cannot have missed the deadline for it.
 */
function draftMoment(charter: CharterEntry[]): Date | null {
  const entry = charter.find((e) => e.key === 'draft-date')
  if (!entry || entry.status !== 'locked') return null

  const when = entry.metadata?.when
  if (when?.date) {
    const t = when.time || '23:59'
    const d = new Date(`${when.date}T${t}`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** How many keepers each team may hold, out of the charter. */
function slotLimit(charter: CharterEntry[]): number {
  const entry = charter.find((e) => e.key === 'keeper-slots')
  const m = entry?.value ? /(\d+)/.exec(entry.value) : null
  // One, when the row says nothing a number can be read out of. Every
  // league in this app has had exactly one slot; guessing higher would
  // let somebody declare a second keeper their league never voted for.
  return m ? Math.max(1, Number(m[1])) : 1
}

async function gate(leagueId: string, season: string) {
  const me = await getCurrentUser()
  if (!me) return { error: 'Unauthorized' as const, me: null, charter: [], adapter: null }

  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (!role) {
    return { error: 'Not a member of this league' as const, me: null, charter: [], adapter: null }
  }

  const charter = await adapter.getCharter(leagueId, season)
  return { error: null, me, charter, adapter, role }
}

export async function declareKeeper(input: {
  leagueId: string
  season: string
  playerName: string
  position: string
  roundCost: string
  yearOfKeep: string
  /** The declaration being amended, when this is an edit. */
  replacingId?: string | null
}): Promise<KeeperResult> {
  const g = await gate(input.leagueId, input.season)
  if (g.error || !g.me || !g.adapter) return { success: false, error: g.error }

  const playerName = input.playerName.trim()
  if (!playerName) return { success: false, error: 'Which player?' }
  if (playerName.length > 80) return { success: false, error: 'That name is too long' }

  const deadline = draftMoment(g.charter)
  if (deadline && deadline <= (await getDevNow())) {
    return { success: false, error: 'The draft has started — keepers are set.' }
  }

  const mine = (await g.adapter.getKeepers(input.leagueId, input.season)).filter(
    (k) => k.userId === g.me!.id
  )
  const limit = slotLimit(g.charter)
  const adding = !input.replacingId && !mine.some(
    (k) => k.playerName.toLowerCase() === playerName.toLowerCase()
  )
  if (adding && mine.length >= limit) {
    return {
      success: false,
      error:
        limit === 1
          ? 'You already have a keeper — change that one instead.'
          : `Your league allows ${limit} keepers, and you have ${mine.length}.`,
    }
  }

  const round = input.roundCost.trim() ? Number.parseInt(input.roundCost, 10) : null
  if (round !== null && (Number.isNaN(round) || round < 1 || round > 30)) {
    return { success: false, error: 'Round has to be a number between 1 and 30' }
  }
  const year = input.yearOfKeep.trim() ? Number.parseInt(input.yearOfKeep, 10) : 1
  if (Number.isNaN(year) || year < 1 || year > 10) {
    return { success: false, error: 'Year has to be a number between 1 and 10' }
  }

  await g.adapter.upsertKeeper({
    leagueId: input.leagueId,
    season: input.season,
    userId: g.me.id,
    playerName,
    position: input.position.trim().toUpperCase() || null,
    roundCost: round,
    yearOfKeep: year,
    replacingId: input.replacingId ?? null,
  })

  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  return { success: true, error: null }
}

export async function withdrawKeeper(input: {
  leagueId: string
  season: string
  keeperId: string
}): Promise<KeeperResult> {
  const g = await gate(input.leagueId, input.season)
  if (g.error || !g.me || !g.adapter) return { success: false, error: g.error }

  const keeper = (await g.adapter.getKeepers(input.leagueId, input.season)).find(
    (k) => k.id === input.keeperId
  )
  if (!keeper) return { success: true, error: null }

  const isMine = keeper.userId === g.me.id
  const canManage = g.role === 'owner' || g.role === 'admin'
  if (!isMine && !canManage) {
    return { success: false, error: "That's not your keeper." }
  }

  // The draft locks YOUR OWN hands, not the commissioner's — a wrongly
  // declared keeper found on draft night still has to be removable.
  const deadline = draftMoment(g.charter)
  if (isMine && !canManage && deadline && deadline <= (await getDevNow())) {
    return { success: false, error: 'The draft has started — keepers are set.' }
  }

  await g.adapter.deleteKeeper(input.keeperId)
  revalidatePath(`/leagues/${input.leagueId}`, 'layout')
  return { success: true, error: null }
}
