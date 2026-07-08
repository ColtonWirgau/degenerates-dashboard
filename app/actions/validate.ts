'use server'

import { revalidatePath } from 'next/cache'

// AI parlay validation. Re-enabling this against the live OpenAI key is
// scheduled for a follow-up pass — for now in mock mode it pretends every
// leg validates clean.

export async function validateWeekLegs(weekId: string, leagueId: string) {
  console.warn('[mock] validateWeekLegs no-op (returning all-valid)')
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null, validation: { legs: [] } }
}
