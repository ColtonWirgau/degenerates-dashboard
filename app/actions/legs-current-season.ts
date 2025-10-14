'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentSeason } from '@/lib/seasons'

export async function getCurrentSeasonLeaderboard(leagueId: string) {
  const supabase = await createClient()
  const currentSeason = getCurrentSeason()

  // Get all parlays for current season only
  const { data: parlays } = await supabase
    .from('parlays_with_weeks')
    .select('parlay_id')
    .eq('league_id', leagueId)
    .eq('season', currentSeason.id)

  if (!parlays || parlays.length === 0) {
    return { leaderboard: [], error: null }
  }

  const parlayIds = parlays.map(p => p.parlay_id)

  // Get all legs for current season parlays
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

export async function getCurrentSeasonUserStats(leagueId: string) {
  const supabase = await createClient()
  const currentSeason = getCurrentSeason()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { stats: null, error: 'Unauthorized' }
  }

  // Get all parlays for current season only
  const { data: parlays } = await supabase
    .from('parlays_with_weeks')
    .select('parlay_id')
    .eq('league_id', leagueId)
    .eq('season', currentSeason.id)

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

  const parlayIds = parlays.map(p => p.parlay_id)

  // Get all user's legs for current season parlays
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
