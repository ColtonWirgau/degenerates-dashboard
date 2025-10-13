'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitParlay(
  weekId: string,
  leagueId: string,
  legs: Array<{ description: string; odds: string }>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if week is open
  const { data: week } = await supabase
    .from('weeks')
    .select('status, deadline')
    .eq('id', weekId)
    .single()

  if (!week) {
    return { success: false, error: 'Week not found' }
  }

  if (week.status !== 'open') {
    return { success: false, error: 'Week is closed for submissions' }
  }

  // Check if past deadline
  if (new Date(week.deadline) < new Date()) {
    return { success: false, error: 'Submission deadline has passed' }
  }

  // Check if user already has a parlay for this week
  const { data: existingParlay } = await supabase
    .from('parlays')
    .select('id')
    .eq('week_id', weekId)
    .eq('user_id', user.id)
    .single()

  if (existingParlay) {
    // Delete existing parlay and its legs
    await supabase
      .from('parlay_legs')
      .delete()
      .eq('parlay_id', existingParlay.id)

    await supabase
      .from('parlays')
      .delete()
      .eq('id', existingParlay.id)
  }

  // Create new parlay
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .insert({
      week_id: weekId,
      user_id: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (parlayError || !parlay) {
    console.error('Error creating parlay:', parlayError)
    return { success: false, error: 'Failed to submit parlay' }
  }

  // Create legs
  const legsData = legs.map((leg, index) => ({
    parlay_id: parlay.id,
    leg_number: index + 1,
    description: leg.description,
    odds: leg.odds,
    result: null,
  }))

  const { error: legsError } = await supabase
    .from('parlay_legs')
    .insert(legsData)

  if (legsError) {
    console.error('Error creating legs:', legsError)
    // Rollback parlay
    await supabase.from('parlays').delete().eq('id', parlay.id)
    return { success: false, error: 'Failed to submit parlay legs' }
  }

  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function getUserParlay(weekId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { parlay: null, legs: [], error: 'Unauthorized' }
  }

  // Get parlay
  const { data: parlay } = await supabase
    .from('parlays')
    .select('*')
    .eq('week_id', weekId)
    .eq('user_id', user.id)
    .single()

  if (!parlay) {
    return { parlay: null, legs: [], error: null }
  }

  // Get legs
  const { data: legs } = await supabase
    .from('parlay_legs')
    .select('*')
    .eq('parlay_id', parlay.id)
    .order('leg_number', { ascending: true })

  return { parlay, legs: legs || [], error: null }
}

export async function getAllParlays(weekId: string) {
  const supabase = await createClient()

  // Get all parlays for this week with user info
  const { data: parlays, error } = await supabase
    .from('parlays')
    .select(`
      *,
      user:user_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('week_id', weekId)

  if (error) {
    console.error('Error fetching parlays:', error)
    return { parlays: [], error: 'Failed to load parlays' }
  }

  // Get all legs for these parlays
  const parlayIds = parlays.map(p => p.id)
  const { data: legs } = await supabase
    .from('parlay_legs')
    .select('*')
    .in('parlay_id', parlayIds)
    .order('leg_number', { ascending: true })

  // Organize legs by parlay
  const parlaysWithLegs = parlays.map(parlay => ({
    ...parlay,
    legs: legs?.filter(leg => leg.parlay_id === parlay.id) || [],
  }))

  return { parlays: parlaysWithLegs, error: null }
}

export async function updateLegResult(
  leagueId: string,
  weekId: string,
  legId: string,
  result: 'win' | 'loss' | 'push'
) {
  console.log('[updateLegResult] Starting with:', { leagueId, weekId, legId, result })

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('[updateLegResult] No user found')
    return { success: false, error: 'Unauthorized' }
  }

  console.log('[updateLegResult] User:', user.id)

  // Check if user is owner or admin
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  console.log('[updateLegResult] Membership:', membership)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    console.log('[updateLegResult] User is not owner/admin')
    return { success: false, error: 'Only owners and admins can update results' }
  }

  console.log('[updateLegResult] Updating leg result...')
  const { data: updatedLeg, error: updateError } = await supabase
    .from('parlay_legs')
    .update({ result })
    .eq('id', legId)
    .select()

  console.log('[updateLegResult] Update result:', { updatedLeg, updateError })

  if (updateError) {
    console.error('[updateLegResult] Error updating leg result:', updateError)
    return { success: false, error: `Failed to update result: ${updateError.message}` }
  }

  console.log('[updateLegResult] Success! Revalidating...')
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function createFinalParlay(
  weekId: string,
  leagueId: string,
  selectedLegIds: string[],
  combinedOdds: string
) {
  console.log('[createFinalParlay] Starting with:', { weekId, leagueId, selectedLegIds, combinedOdds })

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('[createFinalParlay] No user found')
    return { success: false, error: 'Unauthorized' }
  }

  console.log('[createFinalParlay] User:', user.id)

  // Check if user is owner/admin
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  console.log('[createFinalParlay] Membership:', membership)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    console.log('[createFinalParlay] User is not owner/admin')
    return { success: false, error: 'Only owners and admins can create final parlays' }
  }

  // Check if week is still open
  const { data: week } = await supabase
    .from('weeks')
    .select('status')
    .eq('id', weekId)
    .single()

  console.log('[createFinalParlay] Week:', week)

  if (!week) {
    console.log('[createFinalParlay] Week not found')
    return { success: false, error: 'Week not found' }
  }

  if (week.status !== 'open') {
    console.log('[createFinalParlay] Week is not open:', week.status)
    return { success: false, error: 'Week is not open' }
  }

  if (selectedLegIds.length === 0) {
    console.log('[createFinalParlay] No legs selected')
    return { success: false, error: 'No legs selected' }
  }

  // Get the existing parlay for this week (should always exist now)
  console.log('[createFinalParlay] Fetching existing parlay...')
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .select('id')
    .eq('week_id', weekId)
    .single()

  if (parlayError || !parlay) {
    console.error('[createFinalParlay] Error fetching parlay:', parlayError)
    return { success: false, error: 'Week parlay not found' }
  }

  console.log('[createFinalParlay] Parlay found:', parlay.id)

  // Update parlay with combined odds
  console.log('[createFinalParlay] Updating parlay odds...')
  const { error: updateParlayError } = await supabase
    .from('parlays')
    .update({ total_odds: combinedOdds })
    .eq('id', parlay.id)

  if (updateParlayError) {
    console.error('[createFinalParlay] Error updating parlay:', updateParlayError)
    return { success: false, error: `Failed to update parlay: ${updateParlayError.message}` }
  }

  // Update selected legs with leg numbers
  console.log('[createFinalParlay] Updating legs...')

  // Update each leg individually to assign leg_number
  for (let i = 0; i < selectedLegIds.length; i++) {
    const { error: updateError } = await supabase
      .from('parlay_legs')
      .update({ leg_number: i + 1 })
      .eq('id', selectedLegIds[i])

    if (updateError) {
      console.error('[createFinalParlay] Error updating leg:', updateError)
      return { success: false, error: `Failed to update legs: ${updateError.message}` }
    }
  }

  console.log('[createFinalParlay] Legs updated successfully')

  // Lock the week - await it properly
  console.log('[createFinalParlay] Locking week...')
  const { error: lockError } = await supabase
    .from('weeks')
    .update({ status: 'locked' })
    .eq('id', weekId)

  if (lockError) {
    console.error('[createFinalParlay] Error locking week:', lockError)
    return { success: false, error: `Failed to lock week: ${lockError.message}` }
  }

  console.log('[createFinalParlay] Week locked successfully')

  // Revalidate
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  revalidatePath(`/leagues/${leagueId}`)

  console.log('[createFinalParlay] Success!')
  return { success: true, error: null }
}

export async function getFinalParlay(weekId: string) {
  const supabase = await createClient()

  console.log('[getFinalParlay] Fetching parlay for week:', weekId)

  // Get the final parlay for this week (just find any parlay for this week)
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .select('*')
    .eq('week_id', weekId)
    .maybeSingle()

  console.log('[getFinalParlay] Parlay result:', { parlay, parlayError })

  // If there's an error or no parlay, return null early
  if (parlayError) {
    console.error('[getFinalParlay] Error fetching parlay:', parlayError)
    return { parlay: null, legs: [], error: null }
  }

  if (!parlay) {
    console.log('[getFinalParlay] No parlay found for this week')
    return { parlay: null, legs: [], error: null }
  }

  // Get all legs for this parlay with user info
  const { data: legs, error: legsError } = await supabase
    .from('parlay_legs')
    .select(`
      *,
      user:user_profiles!user_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('parlay_id', parlay.id)
    .order('leg_number', { ascending: true })

  console.log('[getFinalParlay] Legs result:', { legsError, count: legs?.length || 0 })

  if (legsError) {
    console.error('[getFinalParlay] Error fetching legs:', legsError)
    return { parlay, legs: [], error: null }
  }

  return { parlay, legs: legs || [], error: null }
}

export async function unlockWeekAndDeleteParlay(
  weekId: string,
  leagueId: string,
  parlayId: string
) {
  console.log('[unlockWeekAndDeleteParlay] Starting with:', { weekId, leagueId, parlayId })

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('[unlockWeekAndDeleteParlay] No user found')
    return { success: false, error: 'Unauthorized' }
  }

  console.log('[unlockWeekAndDeleteParlay] User:', user.id)

  // Check if user is owner/admin
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  console.log('[unlockWeekAndDeleteParlay] Membership:', membership)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    console.log('[unlockWeekAndDeleteParlay] User is not owner/admin')
    return { success: false, error: 'Only owners and admins can unlock weeks' }
  }

  // Reset leg numbers for all legs in the parlay
  console.log('[unlockWeekAndDeleteParlay] Resetting leg numbers...')
  const { data: updatedLegs, error: updateLegsError } = await supabase
    .from('parlay_legs')
    .update({ leg_number: 0 })
    .eq('parlay_id', parlayId)
    .select()

  console.log('[unlockWeekAndDeleteParlay] Update legs result:', { updatedLegs, updateLegsError })

  if (updateLegsError) {
    console.error('[unlockWeekAndDeleteParlay] Error resetting leg numbers:', updateLegsError)
    return { success: false, error: `Failed to reset leg numbers: ${updateLegsError.message}` }
  }

  // Clear the parlay's total odds
  console.log('[unlockWeekAndDeleteParlay] Clearing parlay odds...')
  const { error: updateParlayError } = await supabase
    .from('parlays')
    .update({ total_odds: null })
    .eq('id', parlayId)

  if (updateParlayError) {
    console.error('[unlockWeekAndDeleteParlay] Error clearing odds:', updateParlayError)
    return { success: false, error: `Failed to clear parlay odds: ${updateParlayError.message}` }
  }

  // Unlock the week
  console.log('[unlockWeekAndDeleteParlay] Unlocking week...')
  const { data: updatedWeek, error: unlockWeekError } = await supabase
    .from('weeks')
    .update({ status: 'open' })
    .eq('id', weekId)
    .select()

  console.log('[unlockWeekAndDeleteParlay] Unlock week result:', { updatedWeek, unlockWeekError })

  if (unlockWeekError) {
    console.error('[unlockWeekAndDeleteParlay] Error unlocking week:', unlockWeekError)
    return { success: false, error: `Failed to unlock week: ${unlockWeekError.message}` }
  }

  console.log('[unlockWeekAndDeleteParlay] Success! Revalidating paths...')
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  revalidatePath(`/leagues/${leagueId}`)

  console.log('[unlockWeekAndDeleteParlay] Complete!')
  return { success: true, error: null }
}
