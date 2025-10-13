'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateParlayLegs } from '@/lib/openai'

export async function validateWeekLegs(weekId: string, leagueId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user is owner or admin
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return { success: false, error: 'Only owners and admins can validate legs' }
  }

  // Get all legs for this week
  const { data: legs } = await supabase
    .from('parlay_legs')
    .select('id, description, odds')
    .eq('week_id', weekId)
    .is('parlay_id', null)
    .order('created_at', { ascending: true })

  if (!legs || legs.length === 0) {
    return { success: false, error: 'No legs to validate' }
  }

  // Validate with OpenAI
  const validation = await validateParlayLegs(legs)

  if (!validation || !validation.legs) {
    return { success: false, error: 'AI validation failed. Please try again.' }
  }

  // Update each leg with validation results
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]
    const result = validation.legs[i]

    if (!result) continue

    const status = result.status === 'valid' ? 'approved' : 'conflicting'
    const message = result.status === 'conflicting'
      ? `Conflicts with leg ${result.conflicts_with?.join(', ')}: ${result.reason}`
      : 'Valid'

    await supabase
      .from('parlay_legs')
      .update({
        validation_status: status,
        validation_message: message,
      })
      .eq('id', leg.id)
  }

  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null, validation }
}
