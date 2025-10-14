'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDashboardStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      leagueCount: 0,
      activeParlays: 0,
      winRate: 0,
      recentActivity: [],
      error: 'Unauthorized',
    }
  }

  // Get leagues where user is a member
  const { data: leagues } = await supabase
    .from('leagues')
    .select(
      `
      id,
      name,
      league_members!inner (
        role
      )
    `
    )
    .eq('league_members.user_id', user.id)

  const leagueCount = leagues?.length || 0

  if (!leagues || leagues.length === 0) {
    return {
      leagueCount: 0,
      activeParlays: 0,
      winRate: 0,
      recentActivity: [],
      error: null,
    }
  }

  const leagueIds = leagues.map((l) => l.id)

  // Get all weeks for user's leagues
  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, status, deadline, league_id, created_at')
    .in('league_id', leagueIds)
    .order('created_at', { ascending: false })

  // Count active weeks (open or locked)
  const activeParlays =
    weeks?.filter((w) => w.status === 'open' || w.status === 'locked').length || 0

  // Get all weeks for user's leagues
  const weekIds = weeks?.map((w) => w.id) || []

  // Get the user's personal leg submissions (not the entire parlay, just their legs)
  const { data: userLegs } = await supabase
    .from('parlay_legs')
    .select('id, week_id, result, leg_number, user_id, parlay_id')
    .in('week_id', weekIds)
    .eq('user_id', user.id)
    .gt('leg_number', 0) // Only legs that are part of final parlays

  // Get all parlays for these weeks (for activity feed)
  const { data: parlays } = await supabase
    .from('parlays')
    .select('id, week_id, status, total_odds')
    .in('week_id', weekIds)
    .not('total_odds', 'is', null) // Only finalized parlays

  // Calculate user's personal win rate based on their leg outcomes
  let winRate = 0
  if (userLegs && userLegs.length > 0) {
    const completedLegs = userLegs.filter((leg) => leg.result !== null)
    const wonLegs = completedLegs.filter((leg) => leg.result === 'win')
    winRate =
      completedLegs.length > 0 ? Math.round((wonLegs.length / completedLegs.length) * 100) : 0
  }

  if (!parlays || parlays.length === 0) {
    // Get recent activity (just weeks created/updated)
    const recentActivity =
      weeks
        ?.slice(0, 5)
        .map((week) => {
          const league = leagues.find((l) => l.id === week.league_id)
          return {
            type: 'week_created' as const,
            message: `Week ${week.week_number} created in ${league?.name || 'Unknown League'}`,
            timestamp: week.created_at,
            weekId: week.id,
            leagueId: week.league_id,
          }
        }) || []

    return {
      leagueCount,
      activeParlays,
      winRate,
      recentActivity,
      error: null,
    }
  }

  const parlayIds = parlays.map((p) => p.id)

  // Get all legs for these parlays to calculate parlay results (for activity feed)
  const { data: legs } = await supabase
    .from('parlay_legs')
    .select('id, parlay_id, result, leg_number')
    .in('parlay_id', parlayIds)
    .gt('leg_number', 0) // Only legs that are part of final parlays

  // Calculate parlay results for activity feed
  const parlayResults = parlays.map((parlay) => {
    const parlayLegs = legs?.filter((leg) => leg.parlay_id === parlay.id) || []

    if (parlayLegs.length === 0) {
      return 'pending'
    }

    const hasNull = parlayLegs.some((leg) => leg.result === null)
    const hasLoss = parlayLegs.some((leg) => leg.result === 'loss')
    const allWins = parlayLegs.every((leg) => leg.result === 'win')

    if (hasNull) {
      return 'pending'
    } else if (hasLoss) {
      return 'loss'
    } else if (allWins) {
      return 'win'
    } else {
      return 'push'
    }
  })

  // Get recent activity - combine week updates and parlay results
  const recentActivity = weeks
    ?.slice(0, 10)
    .map((week) => {
      const league = leagues.find((l) => l.id === week.league_id)
      const parlay = parlays.find((p) => p.week_id === week.id)

      if (parlay) {
        const parlayLegs = legs?.filter((leg) => leg.parlay_id === parlay.id) || []
        const hasResult = parlayLegs.some((leg) => leg.result !== null)

        // Find the user's leg for this parlay
        const userLeg = userLegs?.find((leg) => leg.parlay_id === parlay.id)

        if (hasResult) {
          const parlayResult = parlayResults[parlays.indexOf(parlay)]
          const userLegResult = userLeg?.result || null

          return {
            type: 'parlay_result' as const,
            message: `Week ${week.week_number} in ${league?.name || 'Unknown'}`,
            timestamp: week.created_at,
            weekId: week.id,
            leagueId: week.league_id,
            parlayResult,
            userLegResult,
          }
        } else if (parlay.total_odds) {
          return {
            type: 'parlay_locked' as const,
            message: `Week ${week.week_number} parlay locked in ${league?.name || 'Unknown'}`,
            timestamp: week.created_at,
            weekId: week.id,
            leagueId: week.league_id,
          }
        }
      }

      return {
        type: 'week_created' as const,
        message: `Week ${week.week_number} created in ${league?.name || 'Unknown League'}`,
        timestamp: week.created_at,
        weekId: week.id,
        leagueId: week.league_id,
      }
    })
    .filter(Boolean)
    .slice(0, 5)

  return {
    leagueCount,
    activeParlays,
    winRate,
    recentActivity,
    error: null,
  }
}
