import { getLeague, getLeagueMembers, getCurrentUserRole } from '@/app/actions/leagues'
import { getCurrentWeek, getWeeks } from '@/app/actions/weeks'
import { getCurrentSeasonUserStats, getCurrentSeasonLeaderboard } from '@/app/actions/legs-current-season'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSeason } from '@/lib/seasons'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ParlayResultAnimation } from '@/components/parlay-result-animation'
import { PerformanceChart } from '@/components/performance-chart'
import { RecentLegs } from '@/components/recent-legs'
import { WeekNavigator } from '@/components/week-navigator'
import { MemberManagementDialog } from '@/components/member-management-dialog'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Trophy, Plus, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { league, error: leagueError } = await getLeague(id)
  const { members } = await getLeagueMembers(id)
  const { role: currentUserRole } = await getCurrentUserRole(id)
  const { week: currentWeek } = await getCurrentWeek(id)
  const { weeks: allWeeks } = await getWeeks(id)

  // Filter weeks to only current season
  const currentSeason = getCurrentSeason()
  const currentSeasonWeeks = allWeeks.filter(week => week.season === currentSeason.id)

  // Prepare data for all weeks in current season
  const allWeeksData = await Promise.all(
    currentSeasonWeeks.map(async (week) => {
      // Get ALL legs for this week/parlay
      // After migration, week.id is actually a parlay_id
      const { data: allWeekLegs } = await supabase
        .from('parlay_legs')
        .select(`
          *,
          user:user_profiles!user_id (
            id,
            email,
            raw_user_meta_data
          )
        `)
        .eq('parlay_id', week.id)

      const weekLegs = allWeekLegs || []
      const submissionCount = new Set(weekLegs.map(l => l.user_id)).size

      // Debug: Log query results
      if (week.week_number === 7) {
        console.log('[LeaguePage] Week 7 query - parlay_id:', week.id)
        console.log('[LeaguePage] Week 7 legs found:', weekLegs.length)
        console.log('[LeaguePage] Week 7 legs:', weekLegs.map(l => ({ user: l.user_id, parlay: l.parlay_id, desc: l.description })))
      }

      // Get user's leg
      const userLeg = weekLegs.find(leg => leg.user_id === user?.id) || null

      // Calculate this week's stats
      const weekStats = {
        wins: weekLegs.filter(leg => leg.result === 'win').length,
        losses: weekLegs.filter(leg => leg.result === 'loss').length,
        pushes: weekLegs.filter(leg => leg.result === 'push').length,
        pending: weekLegs.filter(leg => leg.result === null).length
      }

      // Extract winners and losers
      const winners = weekLegs
        .filter(leg => leg.result === 'win')
        .map(leg => ({
          userId: leg.user_id,
          fullName: leg.user?.raw_user_meta_data?.full_name || null,
          email: leg.user?.email || '',
          avatarUrl: leg.user?.raw_user_meta_data?.avatar_url || null,
        }))

      const losers = weekLegs
        .filter(leg => leg.result === 'loss')
        .map(leg => ({
          userId: leg.user_id,
          fullName: leg.user?.raw_user_meta_data?.full_name || null,
          email: leg.user?.email || '',
          avatarUrl: leg.user?.raw_user_meta_data?.avatar_url || null,
        }))

      // Get users who have submitted (for open weeks)
      const submittedUsers = weekLegs.map(leg => ({
        userId: leg.user_id,
        fullName: leg.user?.raw_user_meta_data?.full_name || null,
        email: leg.user?.email || '',
        avatarUrl: leg.user?.raw_user_meta_data?.avatar_url || null,
      }))

      // Get users who haven't submitted (for open weeks)
      const submittedUserIds = new Set(weekLegs.map(l => l.user_id))
      const notSubmittedUsers = members
        .filter(m => !submittedUserIds.has(m.user_id))
        .map(m => ({
          userId: m.user_id,
          fullName: m.full_name || null,
          email: m.email,
          avatarUrl: m.raw_user_meta_data?.avatar_url || m.avatar_url || null,
        }))

      // Debug: Log slackers data for week 7
      if (week.week_number === 7) {
        console.log('[LeaguePage] Week 7 notSubmittedUsers:', notSubmittedUsers.map(u => ({
          email: u.email,
          avatarUrl: u.avatarUrl,
          fullName: u.fullName
        })))
      }

      return {
        week,
        submissionCount,
        userLeg,
        weekStats,
        winners,
        losers,
        submittedUsers,
        notSubmittedUsers,
      }
    })
  )

  // Find the index of the current week (or default to first week)
  const currentWeekIndex = currentWeek
    ? allWeeksData.findIndex(wd => wd.week.id === currentWeek.id)
    : 0

  // Get the current week's user leg for animation
  const currentWeekData = allWeeksData[currentWeekIndex]
  const userLegWithResult = currentWeekData?.userLeg || null

  // Handle access denied error with custom message
  if (leagueError === 'Access denied - not a member of this league') {
    return (
      <div className="min-h-[100dvh] ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24 pb-24">
          <Card className="glass-card border-primary/30 max-w-2xl mx-auto">
            <CardContent className="text-center py-12 space-y-4">
              <div className="text-6xl">🔒</div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Access Denied</h3>
                <p className="text-muted-foreground mb-4">
                  You are not a member of this league. Ask a league admin for an invite link to join.
                </p>
                <Link href="/leagues">
                  <Button className="neon-glow-blue">
                    Back to My Leagues
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (leagueError || !league) {
    notFound()
  }

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isLocked = currentWeek ? currentWeek.status === 'locked' || currentWeek.status === 'closed' : false

  // Get user stats and leaderboard for CURRENT SEASON ONLY
  const { stats: userStats } = await getCurrentSeasonUserStats(id)
  const { leaderboard = [] } = await getCurrentSeasonLeaderboard(id)

  // Get recent legs for the user in this league
  // Join through parlays instead of weeks
  console.log('[LeaguePage] Fetching recent legs for user:', user?.id, 'in league:', id)
  const { data: recentLegsData, error: recentLegsError } = await supabase
    .from('parlay_legs')
    .select(`
      id,
      description,
      odds,
      result,
      parlay_id,
      leg_number,
      created_at,
      parlays!inner (
        id,
        league_id,
        global_week_id,
        global_weeks!inner (
          week_number
        )
      )
    `)
    .eq('user_id', user?.id)
    .eq('parlays.league_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (recentLegsError) {
    console.error('[LeaguePage] Error fetching recent legs:', recentLegsError)
  }

  const recentLegs = recentLegsData?.map(leg => {
    const parlay = Array.isArray(leg.parlays) ? leg.parlays[0] : leg.parlays
    const globalWeek = parlay?.global_weeks
    const week = Array.isArray(globalWeek) ? globalWeek[0] : globalWeek
    return {
      id: leg.id,
      description: leg.description || '',
      odds: leg.odds || '',
      result: leg.result as 'win' | 'loss' | 'push' | null,
      week_number: week?.week_number || 0,
      week_id: parlay?.id || '', // Use parlay ID as week ID for compatibility
    }
  }) || []

  // Filter out current week and get only one leg per unique week (the most recent one)
  // Then take the 3 most recent weeks
  const currentWeekNumber = currentWeek?.week_number
  const legsWithoutCurrentWeek = currentWeekNumber
    ? recentLegs.filter(leg => leg.week_number !== currentWeekNumber)
    : recentLegs

  // Group by week_number and take the first (most recent) leg for each week
  const uniqueWeekLegs = new Map<number, typeof recentLegs[0]>()
  for (const leg of legsWithoutCurrentWeek) {
    if (!uniqueWeekLegs.has(leg.week_number)) {
      uniqueWeekLegs.set(leg.week_number, leg)
    }
  }

  // Convert to array, sort by week_number descending, and take first 3
  const recentLegsFiltered = Array.from(uniqueWeekLegs.values())
    .sort((a, b) => b.week_number - a.week_number)
    .slice(0, 3)

  console.log('[LeaguePage] Current week number:', currentWeekNumber)
  console.log('[LeaguePage] Recent legs filtered:', recentLegsFiltered.map(l => ({ week: l.week_number, desc: l.description })))

  // Debug logging for recent legs
  console.log('[LeaguePage] Recent legs count:', recentLegsData?.length || 0)
  console.log('[LeaguePage] Recent legs query result:', recentLegsData?.map(l => {
    const parlay = Array.isArray(l.parlays) ? l.parlays[0] : l.parlays
    const globalWeek = parlay?.global_weeks
    const week = Array.isArray(globalWeek) ? globalWeek[0] : globalWeek
    return {
      week: week?.week_number,
      leg_number: l.leg_number,
      desc: l.description,
      result: l.result,
      created_at: l.created_at
    }
  }))
  console.log('[LeaguePage] Recent legs (mapped):', recentLegs)

  // Debug logging
  console.log('[LeaguePage] Week status:', currentWeek?.status)
  console.log('[LeaguePage] Is locked:', isLocked)
  console.log('[LeaguePage] User stats:', userStats)
  console.log('[LeaguePage] Leaderboard length:', leaderboard.length)

  return (
    <div className="min-h-[100dvh] ambient-glow">
      {/* Win/Loss Animation */}
      {isLocked && userLegWithResult && (
        <ParlayResultAnimation
          result={userLegWithResult.result as 'win' | 'loss' | 'push' | null}
          userParlay={{ legs: [userLegWithResult] }}
        />
      )}

      <Header />

      <main className="container mx-auto px-4 py-8 pt-24 pb-24">
        {/* League Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neon-blue break-words">{league.name}</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            {canManage && (
              <MemberManagementDialog
                leagueId={id}
                leagueName={league.name}
                inviteCode={league.invite_code}
                members={members.map(m => ({
                  id: m.id,
                  user_id: m.user_id,
                  full_name: m.full_name,
                  email: m.email,
                  avatar_url: m.avatar_url,
                  role: m.role as 'owner' | 'admin' | 'member',
                  joined_at: m.joined_at,
                }))}
                currentUserRole={currentUserRole}
              />
            )}
            <Link href={`/leagues/${id}/history`} className="w-full sm:w-auto">
              <Button variant="outline" className="glass border-primary/30 w-full">
                <History className="h-4 w-4 mr-2" />
                View History
              </Button>
            </Link>
          </div>
        </div>

        {/* Week Navigator */}
        {allWeeksData.length > 0 ? (
          <>
          <WeekNavigator
            leagueId={id}
            allWeeksData={allWeeksData}
            currentWeekIndex={currentWeekIndex}
            canManage={canManage}
            membersCount={members.length}
          />

          {/* Season Stats - Always visible */}
          {/* Personal Stats */}
          {userStats && (
            <Card className="glass-card border-primary/30 mb-6">
              <CardHeader>
                <CardTitle className="text-2xl">Your Performance</CardTitle>
                <CardDescription>2025-2026 season statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 md:h-full">
                  <RecentLegs legs={recentLegsFiltered} leagueId={id} userId={user?.id} maxDisplay={3} showViewAll={true} />
                  <PerformanceChart
                    wins={userStats.wins}
                    losses={userStats.losses}
                    pushes={userStats.pushes}
                    winRate={userStats.winRate}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Trophy className="h-6 w-6 text-gold" />
                Leaderboard
              </CardTitle>
              <CardDescription>Top performers this season</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No data yet. Start submitting legs to see the leaderboard!
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((member, index) => {
                    const getInitials = (name: string | null, email: string) => {
                      if (name) {
                        const parts = name.split(' ')
                        if (parts.length >= 2) {
                          return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
                        }
                        return name.slice(0, 2).toUpperCase()
                      }
                      return email.slice(0, 2).toUpperCase()
                    }

                    // Calculate actual rank (handle ties)
                    let rank = 1
                    for (let i = 0; i < index; i++) {
                      if (leaderboard[i].winRate !== member.winRate || leaderboard[i].wins !== member.wins) {
                        rank = i + 2
                      }
                    }

                    // Determine if this is last place (handle ties for last)
                    const lastPlaceWinRate = leaderboard[leaderboard.length - 1].winRate
                    const lastPlaceWins = leaderboard[leaderboard.length - 1].wins
                    const isLastPlace = member.winRate === lastPlaceWinRate && member.wins === lastPlaceWins

                    const isCurrentUser = member.userId === user?.id
                    const rankClass = rank === 1 ? 'text-gold' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-700' : 'text-muted-foreground'
                    const rankIcon = isLastPlace ? '💩' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

                    return (
                      <Link
                        key={member.userId}
                        href={`/leagues/${id}/users/${member.userId}`}
                        className="block"
                      >
                        <div
                          className={`glass-card hover:glass-intense transition-all p-3 cursor-pointer ${
                            isCurrentUser ? 'border-primary/50 neon-glow-blue' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`text-xl sm:text-2xl font-bold ${rankClass} w-10 sm:w-12 text-center flex-shrink-0`}>
                              {rankIcon}
                            </div>

                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={member.avatarUrl || undefined} alt={member.fullName || member.email} />
                              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                {getInitials(member.fullName, member.email)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm break-words">
                                {member.fullName || member.email}
                                {isCurrentUser && (
                                  <Badge variant="outline" className="ml-2 text-xs border-primary/30">
                                    You
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.wins}W - {member.losses}L
                                {member.pushes > 0 && ` - ${member.pushes}P`}
                              </p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className="text-xl sm:text-2xl font-bold text-neon-blue whitespace-nowrap">
                                {member.winRate.toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                {member.total} total
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </>
        ) : (
          <Card className="glass-card">
            <CardContent className="text-center py-12 space-y-4">
              <div className="text-6xl">🎰</div>
              <div>
                <h3 className="text-2xl font-bold mb-2">No Active Week</h3>
                <p className="text-muted-foreground mb-4">
                  {canManage ? 'Create a new week to get started!' : 'Ask an admin to create a new week.'}
                </p>
                {canManage && (
                  <Link href={`/leagues/${id}/history`}>
                    <Button className="neon-glow-gold">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Week
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
