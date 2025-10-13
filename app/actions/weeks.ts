'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from './leagues'
import { getCurrentSeason } from '@/lib/seasons'

export async function createWeek(
  leagueId: string,
  formData: FormData
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user is owner or admin
  const { role } = await getCurrentUserRole(leagueId)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can create weeks' }
  }

  const weekNumber = parseInt(formData.get('week_number') as string)
  const deadline = formData.get('deadline') as string

  if (!weekNumber || !deadline) {
    return { success: false, error: 'All fields are required' }
  }

  // Check if week already exists
  const { data: existingWeek } = await supabase
    .from('weeks')
    .select('id')
    .eq('league_id', leagueId)
    .eq('week_number', weekNumber)
    .single()

  if (existingWeek) {
    return { success: false, error: `Week ${weekNumber} already exists` }
  }

  // Create week
  const { data: week, error: insertError } = await supabase
    .from('weeks')
    .insert({
      league_id: leagueId,
      week_number: weekNumber,
      deadline: new Date(deadline).toISOString(),
      status: 'open',
      season: getCurrentSeason().id, // Automatically set current season
    })
    .select()
    .single()

  if (insertError || !week) {
    console.error('Error creating week:', insertError)
    return { success: false, error: 'Failed to create week' }
  }

  // Automatically create an empty parlay for this week
  const { error: parlayError } = await supabase
    .from('parlays')
    .insert({
      week_id: week.id,
      status: 'pending',
      total_odds: null,
      user_id: null, // No owner for team parlays
    })

  if (parlayError) {
    console.error('Error creating parlay:', parlayError)
    // Rollback: delete the week we just created
    await supabase.from('weeks').delete().eq('id', week.id)
    return { success: false, error: 'Failed to create parlay for week' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

export async function getWeeks(leagueId: string) {
  const supabase = await createClient()

  const { data: weeks, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('league_id', leagueId)
    .order('week_number', { ascending: false })

  if (error) {
    console.error('Error fetching weeks:', error)
    return { weeks: [], error: 'Failed to load weeks' }
  }

  return { weeks, error: null }
}

export async function getCurrentWeek(leagueId: string) {
  const supabase = await createClient()

  // Get the most recent week that's either open or locked (not closed)
  const { data: week, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('league_id', leagueId)
    .in('status', ['open', 'locked'])
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching current week:', error)
    return { week: null, error: 'Failed to load current week' }
  }

  return { week, error: null }
}

export async function getWeek(weekId: string) {
  const supabase = await createClient()

  const { data: week, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('id', weekId)
    .single()

  if (error) {
    console.error('Error fetching week:', error)
    return { week: null, error: 'Week not found' }
  }

  return { week, error: null }
}

export async function updateWeekStatus(
  leagueId: string,
  weekId: string,
  status: 'open' | 'locked' | 'closed'
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user is owner or admin
  const { role } = await getCurrentUserRole(leagueId)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can update week status' }
  }

  const { error: updateError } = await supabase
    .from('weeks')
    .update({ status })
    .eq('id', weekId)

  if (updateError) {
    console.error('Error updating week status:', updateError)
    return { success: false, error: 'Failed to update week status' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

export async function updateWeekDeadline(
  leagueId: string,
  weekId: string,
  deadline: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user is owner or admin
  const { role } = await getCurrentUserRole(leagueId)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can update deadlines' }
  }

  const { error: updateError } = await supabase
    .from('weeks')
    .update({ deadline: new Date(deadline).toISOString() })
    .eq('id', weekId)

  if (updateError) {
    console.error('Error updating deadline:', updateError)
    return { success: false, error: 'Failed to update deadline' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

export async function deleteWeek(leagueId: string, weekId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user is owner
  const { role } = await getCurrentUserRole(leagueId)
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can delete weeks' }
  }

  const { error: deleteError } = await supabase
    .from('weeks')
    .delete()
    .eq('id', weekId)

  if (deleteError) {
    console.error('Error deleting week:', deleteError)
    return { success: false, error: 'Failed to delete week' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

export async function getWeekSubmissionCounts(weekIds: string[]) {
  const supabase = await createClient()

  if (weekIds.length === 0) {
    return {}
  }

  // Get all legs for these weeks
  const { data: legs, error } = await supabase
    .from('parlay_legs')
    .select('week_id, user_id')
    .in('week_id', weekIds)

  if (error) {
    console.error('Error fetching submission counts:', error)
    return {}
  }

  // Count unique users per week
  const counts: Record<string, number> = {}
  weekIds.forEach(weekId => {
    const weekLegs = legs?.filter(leg => leg.week_id === weekId) || []
    const uniqueUsers = new Set(weekLegs.map(leg => leg.user_id))
    counts[weekId] = uniqueUsers.size
  })

  return counts
}

export async function getLeagueStats(leagueId: string) {
  const supabase = await createClient()

  // Get all weeks for this league
  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, status')
    .eq('league_id', leagueId)

  if (!weeks || weeks.length === 0) {
    return { totalWeeks: 0, wins: 0, losses: 0, pushes: 0, pending: 0 }
  }

  const weekIds = weeks.map(w => w.id)

  // Get all parlays for these weeks
  const { data: parlays } = await supabase
    .from('parlays')
    .select('id, week_id')
    .in('week_id', weekIds)
    .not('user_id', 'is', null) // Only user parlays, not final parlays

  if (!parlays || parlays.length === 0) {
    return { totalWeeks: weeks.length, wins: 0, losses: 0, pushes: 0, pending: weeks.filter(w => w.status === 'open').length }
  }

  const parlayIds = parlays.map(p => p.id)

  // Get all legs for these parlays with results
  const { data: legs } = await supabase
    .from('parlay_legs')
    .select('parlay_id, result')
    .in('parlay_id', parlayIds)

  if (!legs) {
    return { totalWeeks: weeks.length, wins: 0, losses: 0, pushes: 0, pending: weeks.filter(w => w.status === 'open').length }
  }

  // Group legs by parlay and determine result
  const parlayResults: Record<string, 'win' | 'loss' | 'push' | 'pending'> = {}

  parlays.forEach(parlay => {
    const parlayLegs = legs.filter(leg => leg.parlay_id === parlay.id)

    if (parlayLegs.length === 0) {
      parlayResults[parlay.id] = 'pending'
      return
    }

    const hasNull = parlayLegs.some(leg => leg.result === null)
    const hasLoss = parlayLegs.some(leg => leg.result === 'loss')
    const allWins = parlayLegs.every(leg => leg.result === 'win')
    const hasPush = parlayLegs.some(leg => leg.result === 'push')

    if (hasNull) {
      parlayResults[parlay.id] = 'pending'
    } else if (hasLoss) {
      parlayResults[parlay.id] = 'loss'
    } else if (allWins) {
      parlayResults[parlay.id] = 'win'
    } else if (hasPush) {
      parlayResults[parlay.id] = 'push'
    } else {
      parlayResults[parlay.id] = 'pending'
    }
  })

  const results = Object.values(parlayResults)

  return {
    totalWeeks: weeks.length,
    wins: results.filter(r => r === 'win').length,
    losses: results.filter(r => r === 'loss').length,
    pushes: results.filter(r => r === 'push').length,
    pending: results.filter(r => r === 'pending').length + weeks.filter(w => w.status === 'open').length
  }
}
