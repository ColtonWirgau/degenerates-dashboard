import { getLeague, getLeagueMembers, getCurrentUserRole } from '@/app/actions/leagues'
import { getCurrentWeek } from '@/app/actions/weeks'
import { getCurrentSeasonUserStats, getCurrentSeasonLeaderboard } from '@/app/actions/legs-current-season'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ParlayResultAnimation } from '@/components/parlay-result-animation'
import { PerformanceChart } from '@/components/performance-chart'
import { RecentLegs } from '@/components/recent-legs'
import { WeekStatsChart } from '@/components/week-stats-chart'
import { WeekResults } from '@/components/week-results'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Trophy, Users, Clock, ArrowRight, Plus, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { league, error: leagueError } = await getLeague(id)
  const { members } = await getLeagueMembers(id)
  const { role: currentUserRole } = await getCurrentUserRole(id)
  const { week: currentWeek } = await getCurrentWeek(id)

  // If there's a current week, get its data
  let submissionCount = 0
  let userLegWithResult: {
    id: string
    user_id: string
    result: string | null
    odds?: string
    description?: string
  } | null = null
  let weekStats = { wins: 0, losses: 0, pushes: 0, pending: 0 }
  let winners: Array<{
    userId: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }> = []
  let losers: Array<{
    userId: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }> = []

  if (currentWeek) {

    // Get ALL legs for this week (for stats calculation)
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
      .eq('week_id', currentWeek.id)

    const weekLegs = allWeekLegs || []
    submissionCount = new Set(weekLegs.map(l => l.user_id)).size

    // Get user's leg with result for animation
    userLegWithResult = weekLegs.find(leg => leg.user_id === user?.id) || null

    // Calculate this week's stats from all legs
    weekStats = {
      wins: weekLegs.filter(leg => leg.result === 'win').length,
      losses: weekLegs.filter(leg => leg.result === 'loss').length,
      pushes: weekLegs.filter(leg => leg.result === 'push').length,
      pending: weekLegs.filter(leg => leg.result === null).length
    }

    // Extract winners and losers
    winners = weekLegs
      .filter(leg => leg.result === 'win')
      .map(leg => ({
        userId: leg.user_id,
        fullName: leg.user?.raw_user_meta_data?.full_name || null,
        email: leg.user?.email || '',
        avatarUrl: leg.user?.raw_user_meta_data?.avatar_url || null,
      }))

    losers = weekLegs
      .filter(leg => leg.result === 'loss')
      .map(leg => ({
        userId: leg.user_id,
        fullName: leg.user?.raw_user_meta_data?.full_name || null,
        email: leg.user?.email || '',
        avatarUrl: leg.user?.raw_user_meta_data?.avatar_url || null,
      }))
  }

  if (leagueError || !league) {
    notFound()
  }

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const deadline = currentWeek ? new Date(currentWeek.deadline) : null
  const isPastDeadline = deadline ? deadline < new Date() : false
  const isLocked = currentWeek ? currentWeek.status === 'locked' || currentWeek.status === 'closed' : false

  // Get user stats and leaderboard for CURRENT SEASON ONLY
  const { stats: userStats } = await getCurrentSeasonUserStats(id)
  const { leaderboard = [] } = await getCurrentSeasonLeaderboard(id)

  // Get recent legs for the user in this league
  const { data: recentLegsData } = await supabase
    .from('parlay_legs')
    .select(`
      id,
      description,
      odds,
      result,
      week_id,
      weeks!inner (
        id,
        week_number,
        league_id
      )
    `)
    .eq('user_id', user?.id)
    .eq('weeks.league_id', id)
    .gt('leg_number', 0)
    .order('created_at', { ascending: false })
    .limit(10)

  const recentLegs = recentLegsData?.map(leg => {
    const weeks = Array.isArray(leg.weeks) ? leg.weeks[0] : leg.weeks
    return {
      id: leg.id,
      description: leg.description || '',
      odds: leg.odds || '',
      result: leg.result as 'win' | 'loss' | 'push' | null,
      week_number: weeks?.week_number || 0,
      week_id: leg.week_id,
    }
  }) || []

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
          <Link href={`/leagues/${id}/history`} className="shrink-0">
            <Button variant="outline" className="glass border-primary/30 w-full sm:w-auto">
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </Link>
        </div>

        {/* This Week Section */}
        {currentWeek ? (
          <>
          <Card className="glass-intense border-primary/30 neon-glow-blue mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl sm:text-3xl">Week {currentWeek.week_number}</CardTitle>
                  <CardDescription className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm sm:text-base">
                    {isLocked ? (
                      // Show fun message based on outcome when locked
                      weekStats.wins > weekStats.losses ? (
                        <span className="text-neon-blue font-medium">🔥 The boys are eatin&apos; tonight!</span>
                      ) : weekStats.losses > weekStats.wins ? (
                        <span className="text-neon-pink font-medium">💀 The parlay is cooked boys</span>
                      ) : weekStats.wins === weekStats.losses && weekStats.wins > 0 ? (
                        <span className="text-gold font-medium">😬 Saved by the bell</span>
                      ) : (
                        <span className="text-muted-foreground font-medium">⏳ Results pending...</span>
                      )
                    ) : (
                      <>
                        {deadline && (
                          <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              Deadline: {deadline.toLocaleDateString()} at{' '}
                              {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                        )}
                        {isPastDeadline && (
                          <Badge variant="outline" className="text-destructive border-destructive/30 w-fit">
                            Deadline Passed
                          </Badge>
                        )}
                      </>
                    )}
                  </CardDescription>
                </div>
                <Link href={`/leagues/${id}/weeks/${currentWeek.id}`} className="shrink-0 w-full sm:w-auto">
                  <Button className="neon-glow-blue w-full sm:w-auto">
                    View Details
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {/* This Week's Stats */}
              {currentWeek.status === 'open' ? (
                // When open: simple 2-column grid
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="glass-card hover:glass-intense transition-all py-3 gap-0 md:py-6">
                    <CardContent className="px-4 md:px-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Submissions</p>
                          <p className="text-xl md:text-2xl font-bold text-primary">{submissionCount} / {members.length}</p>
                        </div>
                        <Users className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Your Leg Card */}
                  <Card className={`glass-card hover:glass-intense transition-all py-3 gap-0 md:py-6 ${
                  userLegWithResult?.result === 'win' ? 'hover:neon-glow-blue border-neon-blue/30' :
                  userLegWithResult?.result === 'loss' ? 'hover:neon-glow-pink border-destructive/30' :
                  userLegWithResult?.result === 'push' ? 'hover:neon-glow-gold border-gold/30' :
                  'border-primary/20'
                }`}>
                  <CardContent className="px-4 md:px-6">
                    {userLegWithResult ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Your Leg</p>
                        <div className="flex items-center gap-2">
                          <p className="text-base md:text-lg font-medium text-foreground break-words">
                            {userLegWithResult.description || 'No description'}
                          </p>
                          <Badge variant="outline" className="text-sm font-bold flex-shrink-0">
                            {(() => {
                              const oddsStr = String(userLegWithResult.odds).trim()
                              const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
                              if (!isNaN(numOdds) && numOdds > 0 && !oddsStr.startsWith('+')) {
                                return `+${numOdds}`
                              }
                              return userLegWithResult.odds
                            })()}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-2">Your Leg</p>
                          <p className="text-base md:text-lg font-bold text-muted-foreground">Not Set</p>
                          <p className="text-xs text-muted-foreground mt-1">Click &quot;View Details&quot; to submit your leg</p>
                        </div>
                        <Plus className="h-8 w-8 md:h-10 md:w-10 text-primary flex-shrink-0" />
                      </div>
                    )}
                  </CardContent>
                </Card>
                </div>
              ) : (
                // When locked: complex grid layout
                // Mobile: stack all vertically
                // Large screens: chart spans 2 rows in col 1, Your Leg spans 2 cols in row 1, Champions/Graveyard in row 2 cols 2-3
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 lg:grid-rows-2">
                  {/* Chart - spans 2 rows on large screens */}
                  <div className="lg:row-span-2">
                    <WeekStatsChart
                      wins={weekStats.wins}
                      losses={weekStats.losses}
                      pushes={weekStats.pushes}
                      pending={weekStats.pending}
                    />
                  </div>

                  {/* Your Leg - spans 2 columns on large screens */}
                  <Card className={`lg:col-span-2 glass-card hover:glass-intense transition-all py-3 gap-0 md:py-6 ${
                    userLegWithResult?.result === 'win' ? 'hover:neon-glow-blue border-neon-blue/30' :
                    userLegWithResult?.result === 'loss' ? 'hover:neon-glow-pink border-destructive/30' :
                    userLegWithResult?.result === 'push' ? 'hover:neon-glow-gold border-gold/30' :
                    'border-primary/20'
                  }`}>
                    <CardContent className="px-4 md:px-6 h-full">
                      {userLegWithResult ? (
                        <div className="h-full flex flex-col">
                          <p className="text-xs text-muted-foreground mb-2">Your Leg</p>
                          <div className="flex-1 flex items-center">
                            <div className="flex items-center justify-between gap-4 w-full">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-base md:text-lg font-medium text-foreground break-words">
                                  {userLegWithResult.description || 'No description'}
                                </p>
                                <Badge variant="outline" className="text-sm font-bold flex-shrink-0">
                                  {(() => {
                                    const oddsStr = String(userLegWithResult.odds).trim()
                                    const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
                                    if (!isNaN(numOdds) && numOdds > 0 && !oddsStr.startsWith('+')) {
                                      return `+${numOdds}`
                                    }
                                    return userLegWithResult.odds
                                  })()}
                                </Badge>
                              </div>

                              {userLegWithResult.result && (
                                <div className="flex-shrink-0">
                                  {userLegWithResult.result === 'win' && (
                                    <p className="text-2xl sm:text-3xl font-bold text-neon-blue">WIN</p>
                                  )}
                                  {userLegWithResult.result === 'loss' && (
                                    <p className="text-2xl sm:text-3xl font-bold text-destructive">LOSS</p>
                                  )}
                                  {userLegWithResult.result === 'push' && (
                                    <p className="text-2xl sm:text-3xl font-bold text-gold">PUSH</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Your Leg</p>
                          <p className="text-base md:text-lg font-bold text-muted-foreground">None</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Champions Circle and Graveyard - side by side in row 2 on large screens */}
                  <WeekResults winners={winners} losers={losers} compact />
                </div>
              )}

            </CardContent>
          </Card>

          {/* Season Stats - Only show when week is locked */}
          {currentWeek.status !== 'open' && (
            <>
              {/* Personal Stats */}
              {userStats && (
                <Card className="glass-card border-primary/30 mb-6">
                  <CardHeader>
                    <CardTitle className="text-2xl">Your Performance</CardTitle>
                    <CardDescription>2025-2026 season statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-2">
                      <RecentLegs legs={recentLegs} leagueId={id} maxDisplay={3} />
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
          )}
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
