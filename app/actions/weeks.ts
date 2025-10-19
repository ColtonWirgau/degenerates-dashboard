'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from './leagues'
import { getCurrentSeason } from '@/lib/seasons'

/**
 * Create a parlay for a specific week in a league
 * Note: Global weeks should already exist, this just creates the league-specific parlay
 */
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

  const currentSeason = getCurrentSeason().id

  // Get the global week
  const { data: globalWeek, error: globalWeekError } = await supabase
    .from('global_weeks')
    .select('id')
    .eq('season', currentSeason)
    .eq('week_number', weekNumber)
    .single()

  if (globalWeekError || !globalWeek) {
    return { success: false, error: `Week ${weekNumber} does not exist for season ${currentSeason}` }
  }

  // Check if parlay already exists for this league and week
  const { data: existingParlay } = await supabase
    .from('parlays')
    .select('id')
    .eq('league_id', leagueId)
    .eq('global_week_id', globalWeek.id)
    .single()

  if (existingParlay) {
    return { success: false, error: `Week ${weekNumber} already exists for this league` }
  }

  // Parse datetime-local string as local time (not UTC)
  const [datePart, timePart] = deadline.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const localDate = new Date(year, month - 1, day, hour, minute)

  // Create parlay for this league and week
  const { data: parlay, error: insertError } = await supabase
    .from('parlays')
    .insert({
      league_id: leagueId,
      global_week_id: globalWeek.id,
      deadline: localDate.toISOString(),
      status: 'open',
    })
    .select()
    .single()

  if (insertError || !parlay) {
    console.error('Error creating parlay:', insertError)
    return { success: false, error: 'Failed to create week' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

/**
 * Get all parlays (weeks) for a league
 */
export async function getWeeks(leagueId: string) {
  const supabase = await createClient()

  const { data: parlays, error } = await supabase
    .from('parlays_with_weeks')
    .select('*')
    .eq('league_id', leagueId)
    .order('week_number', { ascending: true })

  if (error) {
    console.error('Error fetching weeks:', error)
    return { weeks: [], error: 'Failed to load weeks' }
  }

  // Map to match old week structure
  const weeks = parlays?.map(p => ({
    id: p.parlay_id,
    week_number: p.week_number,
    season: p.season,
    deadline: p.deadline,
    status: p.status,
    league_id: p.league_id,
    global_week_id: p.global_week_id,
    created_at: p.created_at,
  })) || []

  return { weeks, error: null }
}

/**
 * Get the current active week (parlay) for a league based on date
 */
export async function getCurrentWeek(leagueId: string) {
  const supabase = await createClient()
  const currentSeason = getCurrentSeason()

  // Get the current global week based on dates
  // We want: start_date <= NOW <= end_date
  const now = new Date().toISOString()
  const { data: globalWeeks, error: globalWeekError } = await supabase
    .from('global_weeks')
    .select('*')
    .eq('season', currentSeason.id)
    .lte('start_date', now)  // start_date <= now
    .gte('end_date', now)    // end_date >= now
    .order('week_number', { ascending: false })
    .limit(1)

  console.log('[getCurrentWeek] Now:', now)
  console.log('[getCurrentWeek] Global weeks found:', globalWeeks)
  console.log('[getCurrentWeek] Error:', globalWeekError)

  const currentGlobalWeek = globalWeeks?.[0]

  // If no current week by date, fall back to next upcoming week, or most recent open/locked week
  if (!currentGlobalWeek) {
    console.log('[getCurrentWeek] No current week by date, checking for upcoming week...')

    // First try to get the next upcoming week (starts in the future)
    const { data: upcomingWeeks } = await supabase
      .from('global_weeks')
      .select('*')
      .eq('season', currentSeason.id)
      .gte('start_date', now)  // start_date >= now (future weeks)
      .order('week_number', { ascending: true })
      .limit(1)

    const nextGlobalWeek = upcomingWeeks?.[0]

    console.log('[getCurrentWeek] Next upcoming week:', nextGlobalWeek)

    if (nextGlobalWeek) {
      // Get the parlay for this upcoming week
      const { data: parlay } = await supabase
        .from('parlays_with_weeks')
        .select('*')
        .eq('league_id', leagueId)
        .eq('global_week_id', nextGlobalWeek.id)
        .maybeSingle()

      if (parlay) {
        return {
          week: {
            id: parlay.parlay_id,
            week_number: parlay.week_number,
            season: parlay.season,
            deadline: parlay.deadline,
            status: parlay.status,
            league_id: parlay.league_id,
            global_week_id: parlay.global_week_id,
          },
          error: null
        }
      }
    }

    // Last resort: get most recent open/locked week
    const { data: parlay } = await supabase
      .from('parlays_with_weeks')
      .select('*')
      .eq('league_id', leagueId)
      .in('status', ['open', 'locked'])
      .order('week_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!parlay) {
      return { week: null, error: null }
    }

    return {
      week: {
        id: parlay.parlay_id,
        week_number: parlay.week_number,
        season: parlay.season,
        deadline: parlay.deadline,
        status: parlay.status,
        league_id: parlay.league_id,
        global_week_id: parlay.global_week_id,
      },
      error: null
    }
  }

  // Get the parlay for this global week and league
  const { data: parlay, error } = await supabase
    .from('parlays_with_weeks')
    .select('*')
    .eq('league_id', leagueId)
    .eq('global_week_id', currentGlobalWeek.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching current week:', error)
    return { week: null, error: 'Failed to load current week' }
  }

  if (!parlay) {
    return { week: null, error: null }
  }

  // Map to match old week structure
  const week = {
    id: parlay.parlay_id,
    week_number: parlay.week_number,
    season: parlay.season,
    deadline: parlay.deadline,
    status: parlay.status,
    league_id: parlay.league_id,
    global_week_id: parlay.global_week_id,
  }

  return { week, error: null }
}

/**
 * Get a specific week (parlay) by ID
 */
export async function getWeek(weekId: string) {
  const supabase = await createClient()

  const { data: parlay, error } = await supabase
    .from('parlays_with_weeks')
    .select('*')
    .eq('parlay_id', weekId)
    .single()

  if (error) {
    console.error('Error fetching week:', error)
    return { week: null, error: 'Week not found' }
  }

  // Map to match old week structure
  const week = {
    id: parlay.parlay_id,
    week_number: parlay.week_number,
    season: parlay.season,
    deadline: parlay.deadline,
    status: parlay.status,
    league_id: parlay.league_id,
    global_week_id: parlay.global_week_id,
  }

  return { week, error: null }
}

/**
 * Update parlay status
 */
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
    .from('parlays')
    .update({ status })
    .eq('id', weekId)

  if (updateError) {
    console.error('Error updating week status:', updateError)
    return { success: false, error: 'Failed to update week status' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

/**
 * Update parlay deadline
 */
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

  // Parse datetime-local string as local time (not UTC)
  // datetime-local returns "YYYY-MM-DDTHH:mm" which new Date() would treat as UTC
  // We need to explicitly parse it as local time
  const [datePart, timePart] = deadline.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const localDate = new Date(year, month - 1, day, hour, minute)

  const { error: updateError } = await supabase
    .from('parlays')
    .update({ deadline: localDate.toISOString() })
    .eq('id', weekId)

  if (updateError) {
    console.error('Error updating deadline:', updateError)
    return { success: false, error: 'Failed to update deadline' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

/**
 * Delete a parlay (week)
 */
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
    .from('parlays')
    .delete()
    .eq('id', weekId)

  if (deleteError) {
    console.error('Error deleting week:', deleteError)
    return { success: false, error: 'Failed to delete week' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

/**
 * Close current week and create next week's parlay
 */
export async function closeWeekAndCreateNext(leagueId: string, weekId: string) {
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
    return { success: false, error: 'Only owners and admins can close weeks' }
  }

  // Get the current parlay with week info
  const { data: currentParlay } = await supabase
    .from('parlays_with_weeks')
    .select('*')
    .eq('parlay_id', weekId)
    .single()

  if (!currentParlay) {
    return { success: false, error: 'Week not found' }
  }

  // Close the current parlay
  const { error: closeError } = await supabase
    .from('parlays')
    .update({ status: 'closed' })
    .eq('id', weekId)

  if (closeError) {
    console.error('Error closing week:', closeError)
    return { success: false, error: 'Failed to close week' }
  }

  // Check if next global week exists
  const nextWeekNumber = currentParlay.week_number + 1
  const { data: nextGlobalWeek } = await supabase
    .from('global_weeks')
    .select('id')
    .eq('season', currentParlay.season)
    .eq('week_number', nextWeekNumber)
    .single()

  if (nextGlobalWeek) {
    // Check if parlay already exists for next week
    const { data: existingNextParlay } = await supabase
      .from('parlays')
      .select('id')
      .eq('league_id', leagueId)
      .eq('global_week_id', nextGlobalWeek.id)
      .single()

    if (!existingNextParlay) {
      // Get the next global week's details to use its start_date as the deadline
      const { data: nextWeekDetails } = await supabase
        .from('global_weeks')
        .select('start_date')
        .eq('id', nextGlobalWeek.id)
        .single()

      // Use the global week's start_date as the deadline (already in correct ET timezone)
      // If no start_date, fall back to calculated Sunday at 1:15 PM UTC (9:15 AM EDT)
      let deadline: string
      if (nextWeekDetails?.start_date) {
        deadline = nextWeekDetails.start_date
      } else {
        const now = new Date()
        const nextSunday = new Date(now)
        const daysUntilSunday = (7 - now.getDay()) % 7 || 7
        nextSunday.setDate(now.getDate() + daysUntilSunday)
        // Set to 13:15 UTC (9:15 AM EDT) - approximation
        nextSunday.setUTCHours(13, 15, 0, 0)
        deadline = nextSunday.toISOString()
      }

      const { error: createError } = await supabase
        .from('parlays')
        .insert({
          league_id: leagueId,
          global_week_id: nextGlobalWeek.id,
          deadline,
          status: 'open',
        })

      if (createError) {
        console.error('Error creating next week:', createError)
        // Don't fail the close operation if week creation fails
      }
    }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

/**
 * Get submission counts for multiple weeks (parlays)
 */
export async function getWeekSubmissionCounts(weekIds: string[]) {
  const supabase = await createClient()

  if (weekIds.length === 0) {
    return {}
  }

  // Get all legs for these parlays
  // Note: parlay_legs now have parlay_id instead of week_id
  const { data: legs, error } = await supabase
    .from('parlay_legs')
    .select('parlay_id, user_id')
    .in('parlay_id', weekIds)

  if (error) {
    console.error('Error fetching submission counts:', error)
    return {}
  }

  // Count unique users per parlay
  const counts: Record<string, number> = {}
  weekIds.forEach(weekId => {
    const parlayLegs = legs?.filter(leg => leg.parlay_id === weekId) || []
    const uniqueUsers = new Set(parlayLegs.map(leg => leg.user_id))
    counts[weekId] = uniqueUsers.size
  })

  return counts
}

/**
 * Get league stats across all parlays
 */
export async function getLeagueStats(leagueId: string) {
  const supabase = await createClient()

  // Get all parlays for this league
  const { data: parlays } = await supabase
    .from('parlays')
    .select('id, status')
    .eq('league_id', leagueId)

  if (!parlays || parlays.length === 0) {
    return { totalWeeks: 0, wins: 0, losses: 0, pushes: 0, pending: 0 }
  }

  const parlayIds = parlays.map(p => p.id)

  // Get all legs for these parlays with results
  const { data: legs } = await supabase
    .from('parlay_legs')
    .select('parlay_id, result')
    .in('parlay_id', parlayIds)

  if (!legs) {
    return { totalWeeks: parlays.length, wins: 0, losses: 0, pushes: 0, pending: parlays.filter(p => p.status === 'open').length }
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
    totalWeeks: parlays.length,
    wins: results.filter(r => r === 'win').length,
    losses: results.filter(r => r === 'loss').length,
    pushes: results.filter(r => r === 'push').length,
    pending: results.filter(r => r === 'pending').length + parlays.filter(p => p.status === 'open').length
  }
}
