'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
// import { validateParlayLegs } from '@/lib/openai' // TODO: Re-enable when OpenAI quota is fixed

export async function submitLeg(
  weekId: string,
  leagueId: string,
  leg: { description: string; odds: string }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if parlay/week is open
  // Note: weekId now refers to a parlay ID after migration
  const { data: parlay } = await supabase
    .from('parlays')
    .select('status, deadline')
    .eq('id', weekId)
    .single()

  if (!parlay) {
    return { success: false, error: 'Week not found' }
  }

  if (parlay.status !== 'open') {
    return { success: false, error: 'Week is closed for submissions' }
  }

  // Check if user is admin/owner (they can submit after deadline)
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  const canBypassDeadline = membership?.role === 'owner' || membership?.role === 'admin'

  // Check if past deadline
  if (!canBypassDeadline && new Date(parlay.deadline) < new Date()) {
    return { success: false, error: 'Submission deadline has passed' }
  }

  // TODO: Add AI validation back later
  // For now, skip validation to avoid OpenAI quota issues

  // weekId is now the parlay ID after migration
  const parlayId = weekId

  // Check if user already has a leg for this week
  const { data: existingLeg } = await supabase
    .from('parlay_legs')
    .select('id')
    .eq('parlay_id', parlayId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingLeg) {
    // Update existing leg
    const { error: updateError } = await supabase
      .from('parlay_legs')
      .update({
        description: leg.description,
        odds: leg.odds,
        validation_status: 'approved',
        validation_message: 'Valid',
      })
      .eq('id', existingLeg.id)

    if (updateError) {
      console.error('Error updating leg:', updateError)
      return { success: false, error: 'Failed to update leg' }
    }
  } else {
    // Create new leg assigned to the parlay from the start
    const { error: insertError } = await supabase
      .from('parlay_legs')
      .insert({
        user_id: user.id,
        parlay_id: parlayId, // Assigned to parlay immediately
        description: leg.description,
        odds: leg.odds,
        leg_number: 0, // Will be updated when week is locked
        validation_status: 'approved',
        validation_message: 'Valid',
      })

    if (insertError) {
      console.error('Error creating leg:', insertError)
      return { success: false, error: 'Failed to submit leg' }
    }
  }

  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function getUserLeg(weekId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { leg: null, error: 'Unauthorized' }
  }

  // Get user's leg for this week
  // weekId is now the parlay ID after migration
  const { data: leg } = await supabase
    .from('parlay_legs')
    .select('*')
    .eq('parlay_id', weekId)
    .eq('user_id', user.id)
    .single()

  return { leg, error: null }
}

export async function getAllLegsForWeek(weekId: string) {
  const supabase = await createClient()

  // Get all leg submissions for this week
  // weekId is now the parlay ID after migration
  const { data: legs, error } = await supabase
    .from('parlay_legs')
    .select(`
      *,
      user:user_profiles!user_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('parlay_id', weekId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching legs:', error)
    return { legs: [], error: 'Failed to load legs' }
  }

  return { legs: legs || [], error: null }
}

export async function deleteLeg(weekId: string, legId: string, leagueId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user owns this leg or is admin/owner
  const { data: leg } = await supabase
    .from('parlay_legs')
    .select('user_id')
    .eq('id', legId)
    .single()

  if (!leg) {
    return { success: false, error: 'Leg not found' }
  }

  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  const canDelete =
    leg.user_id === user.id ||
    membership?.role === 'owner' ||
    membership?.role === 'admin'

  if (!canDelete) {
    return { success: false, error: 'Not authorized to delete this leg' }
  }

  const { error: deleteError } = await supabase
    .from('parlay_legs')
    .delete()
    .eq('id', legId)

  if (deleteError) {
    console.error('Error deleting leg:', deleteError)
    return { success: false, error: 'Failed to delete leg' }
  }

  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function updateLegAsAdmin(
  weekId: string,
  legId: string,
  leagueId: string,
  leg: { description: string; odds: string }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if user is admin/owner
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return { success: false, error: 'Only admins and owners can edit other users\' legs' }
  }

  // TODO: Add AI validation back later
  // For now, skip validation to avoid OpenAI quota issues

  // Update the leg
  const { error: updateError } = await supabase
    .from('parlay_legs')
    .update({
      description: leg.description,
      odds: leg.odds,
      validation_status: 'approved',
      validation_message: 'Valid',
    })
    .eq('id', legId)

  if (updateError) {
    console.error('Error updating leg:', updateError)
    return { success: false, error: 'Failed to update leg' }
  }

  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function submitLegForUser(
  weekId: string,
  leagueId: string,
  targetUserId: string,
  leg: { description: string; odds: string }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if current user is admin/owner
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return { success: false, error: 'Only admins and owners can submit legs for other users' }
  }

  // Check if target user is a member of the league
  const { data: targetMembership } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('user_id', targetUserId)
    .single()

  if (!targetMembership) {
    return { success: false, error: 'User is not a member of this league' }
  }

  // Check if parlay/week is open
  const { data: parlay } = await supabase
    .from('parlays')
    .select('status')
    .eq('id', weekId)
    .single()

  if (!parlay || parlay.status !== 'open') {
    return { success: false, error: 'Week is not open for submissions' }
  }

  // TODO: Add AI validation back later
  // For now, skip validation to avoid OpenAI quota issues

  // weekId is now the parlay ID
  const parlayId = weekId

  // Check if target user already has a leg for this week
  const { data: existingLeg } = await supabase
    .from('parlay_legs')
    .select('id')
    .eq('parlay_id', parlayId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existingLeg) {
    // Update existing leg
    const { error: updateError } = await supabase
      .from('parlay_legs')
      .update({
        description: leg.description,
        odds: leg.odds,
        validation_status: 'approved',
        validation_message: 'Valid',
      })
      .eq('id', existingLeg.id)

    if (updateError) {
      console.error('Error updating leg:', updateError)
      return { success: false, error: 'Failed to update leg' }
    }
  } else {
    // Create new leg for target user, assigned to parlay immediately
    const { error: insertError } = await supabase
      .from('parlay_legs')
      .insert({
        user_id: targetUserId,
        parlay_id: parlayId, // Assigned to parlay immediately
        description: leg.description,
        odds: leg.odds,
        leg_number: 0,
        validation_status: 'approved',
        validation_message: 'Valid',
      })

    if (insertError) {
      console.error('Error creating leg:', insertError)
      return { success: false, error: 'Failed to submit leg' }
    }
  }

  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function getLeaderboard(leagueId: string) {
  const supabase = await createClient()

  // Get all parlays for this league
  const { data: parlays } = await supabase
    .from('parlays')
    .select('id')
    .eq('league_id', leagueId)

  if (!parlays || parlays.length === 0) {
    return { leaderboard: [], error: null }
  }

  const parlayIds = parlays.map(p => p.id)

  // Get all legs for all parlays
  const { data: allLegs } = await supabase
    .from('parlay_legs')
    .select(`
      user_id,
      result,
      user:user_profiles!user_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .in('parlay_id', parlayIds)

  if (!allLegs) {
    return { leaderboard: [], error: 'Failed to fetch leaderboard data' }
  }

  // Group by user and calculate stats
  const userStats = new Map<string, {
    userId: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    wins: number
    losses: number
    pushes: number
    pending: number
    total: number
    winRate: number
  }>()

  allLegs.forEach(leg => {
    // Type guard: Supabase returns user as an array but we know it's always a single object due to the foreign key
    const user = Array.isArray(leg.user) ? leg.user[0] : leg.user
    if (!user) return

    const userId = leg.user_id
    if (!userStats.has(userId)) {
      userStats.set(userId, {
        userId,
        email: user.email,
        fullName: user.raw_user_meta_data?.full_name || null,
        avatarUrl: user.raw_user_meta_data?.avatar_url || null,
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        total: 0,
        winRate: 0
      })
    }

    const stats = userStats.get(userId)!
    stats.total++

    if (leg.result === 'win') stats.wins++
    else if (leg.result === 'loss') stats.losses++
    else if (leg.result === 'push') stats.pushes++
    else stats.pending++

    // Calculate win rate (excluding pending and pushes)
    const completedGames = stats.wins + stats.losses
    stats.winRate = completedGames > 0 ? (stats.wins / completedGames) * 100 : 0
  })

  // Convert to array and sort by win rate, then by total wins
  const leaderboard = Array.from(userStats.values())
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate
      return b.wins - a.wins
    })

  return { leaderboard, error: null }
}

export async function getUserStats(leagueId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { stats: null, error: 'Unauthorized' }
  }

  // Get all parlays for this league
  const { data: parlays } = await supabase
    .from('parlays')
    .select('id')
    .eq('league_id', leagueId)

  if (!parlays || parlays.length === 0) {
    return {
      stats: {
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        total: 0,
        winRate: 0
      },
      error: null
    }
  }

  const parlayIds = parlays.map(p => p.id)

  // Get all user's legs for all parlays
  const { data: userLegs } = await supabase
    .from('parlay_legs')
    .select('result')
    .in('parlay_id', parlayIds)
    .eq('user_id', user.id)

  if (!userLegs) {
    return { stats: null, error: 'Failed to fetch user stats' }
  }

  const stats = {
    wins: userLegs.filter(leg => leg.result === 'win').length,
    losses: userLegs.filter(leg => leg.result === 'loss').length,
    pushes: userLegs.filter(leg => leg.result === 'push').length,
    pending: userLegs.filter(leg => leg.result === null).length,
    total: userLegs.length,
    winRate: 0
  }

  // Calculate win rate (excluding pending and pushes)
  const completedGames = stats.wins + stats.losses
  stats.winRate = completedGames > 0 ? (stats.wins / completedGames) * 100 : 0

  return { stats, error: null }
}
