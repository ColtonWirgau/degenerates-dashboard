'use server'

import { revalidatePath } from 'next/cache'

interface MockInvitation {
  email: string
  leagues: { id: string; name: string } | { id: string; name: string }[]
}

export async function getInvitation(_token: string): Promise<{
  invitation: MockInvitation | null
  error: string | null
}> {
  return { invitation: null, error: 'Invitations are disabled in mock mode' }
}

export async function acceptInvitation(_token: string) {
  console.warn('[mock] acceptInvitation no-op')
  revalidatePath('/')
  return { success: true, leagueId: null, error: null }
}
