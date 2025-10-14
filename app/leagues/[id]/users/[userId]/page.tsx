import { getLeague } from '@/app/actions/leagues'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PerformanceChart } from '@/components/performance-chart'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentSeason } from '@/lib/seasons'

export default async function UserStatsPage({
  params
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id: leagueId, userId } = await params
  const supabase = await createClient()
  const currentSeason = getCurrentSeason()

  const { league, error: leagueError } = await getLeague(leagueId)

  if (leagueError || !league) {
    notFound()
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, email, raw_user_meta_data')
    .eq('id', userId)
    .single()

  if (!userProfile) {
    notFound()
  }

  const fullName = userProfile.raw_user_meta_data?.full_name || userProfile.email
  const avatarUrl = userProfile.raw_user_meta_data?.avatar_url

  // Get all user's legs for this league in current season through parlays and global_weeks
  const { data: userLegs } = await supabase
    .from('parlay_legs')
    .select(`
      id,
      description,
      odds,
      result,
      created_at,
      parlay_id,
      parlays!inner (
        id,
        league_id,
        global_week_id,
        global_weeks!inner (
          week_number,
          season,
          start_date,
          end_date
        )
      )
    `)
    .eq('user_id', userId)
    .eq('parlays.league_id', leagueId)
    .eq('parlays.global_weeks.season', currentSeason.id)
    .order('created_at', { ascending: false })

  // Sort by week number in descending order (most recent first)
  const sortedLegs = userLegs?.sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parlayA = Array.isArray(a.parlays) ? a.parlays[0] : a.parlays as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parlayB = Array.isArray(b.parlays) ? b.parlays[0] : b.parlays as any
    const weekA = parlayA?.global_weeks
    const weekB = parlayB?.global_weeks
    const weekNumA = Array.isArray(weekA) ? weekA[0]?.week_number : weekA?.week_number
    const weekNumB = Array.isArray(weekB) ? weekB[0]?.week_number : weekB?.week_number
    return (weekNumB || 0) - (weekNumA || 0)
  })

  // Calculate stats
  const stats = {
    wins: userLegs?.filter(leg => leg.result === 'win').length || 0,
    losses: userLegs?.filter(leg => leg.result === 'loss').length || 0,
    pushes: userLegs?.filter(leg => leg.result === 'push').length || 0,
    pending: userLegs?.filter(leg => leg.result === null).length || 0,
    total: userLegs?.length || 0,
  }

  const completedGames = stats.wins + stats.losses
  const winRate = completedGames > 0 ? (stats.wins / completedGames) * 100 : 0

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  // Determine win rate color based on performance
  const getWinRateColor = (rate: number) => {
    if (rate >= 70) return '#FFD700' // gold
    if (rate >= 55) return '#00D9FF' // neon-blue
    if (rate >= 40) return '#00CED1' // dark-cyan
    return '#FF69B4' // neon-pink
  }

  const winRateColor = getWinRateColor(winRate)

  return (
    <div className="min-h-screen ambient-glow">
      <Header />

      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Back Button */}
        <div className="mb-6">
          <Link href={`/leagues/${leagueId}`}>
            <Button variant="outline" size="sm" className="glass border-primary/30">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to League
            </Button>
          </Link>
        </div>

        {/* User Profile Card */}
        <Card className="glass-intense border-primary/30 neon-glow-blue mb-6">
          <CardContent className="pt-6 pb-6">
            {/* Desktop: side by side, Mobile: stacked */}
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
              {/* Left side: Avatar and User Info */}
              <div className="flex flex-col items-center gap-4 lg:flex-1">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl} alt={fullName} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-3xl">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="text-center">
                  <h1 className="text-3xl font-bold text-neon-blue mb-2 break-words">{fullName}</h1>
                  <p className="text-sm text-muted-foreground">{league.name}</p>
                  <p className="text-sm text-muted-foreground">{currentSeason.displayName}</p>
                </div>

                {/* Win Rate Display - Mobile */}
                <div className="lg:hidden text-center">
                  <div className="text-6xl font-bold mb-2" style={{ color: winRateColor }}>
                    {winRate.toFixed(1)}%
                  </div>
                  <p className="text-base text-muted-foreground">Win Rate</p>
                </div>
              </div>

              {/* Right side: Performance Chart - Desktop only */}
              <div className="hidden lg:block lg:flex-1">
                <PerformanceChart
                  wins={stats.wins}
                  losses={stats.losses}
                  pushes={stats.pushes}
                  winRate={winRate}
                />
              </div>
            </div>

            {/* Performance Chart - Mobile */}
            <div className="lg:hidden mt-6">
              <PerformanceChart
                wins={stats.wins}
                losses={stats.losses}
                pushes={stats.pushes}
                winRate={winRate}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bet History */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-2xl">Bet History</CardTitle>
            <CardDescription>All bets for {currentSeason.displayName}</CardDescription>
          </CardHeader>
          <CardContent>
            {!sortedLegs || sortedLegs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No bets submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedLegs.map((leg) => {
                  const parlay = Array.isArray(leg.parlays) ? leg.parlays[0] : leg.parlays
                  const globalWeek = parlay?.global_weeks
                  const week = Array.isArray(globalWeek) ? globalWeek[0] : globalWeek
                  const resultColor =
                    leg.result === 'win' ? 'text-neon-blue border-neon-blue/30 bg-neon-blue/5' :
                    leg.result === 'loss' ? 'text-destructive border-destructive/30 bg-destructive/5' :
                    leg.result === 'push' ? 'text-gold border-gold/30 bg-gold/5' :
                    'text-muted-foreground border-muted-foreground/30'

                  return (
                    <div
                      key={leg.id}
                      className={`glass-card hover:glass-intense transition-all p-3 sm:p-4 border ${resultColor}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-muted-foreground">Week {week?.week_number}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {week?.end_date ? new Date(week.end_date).toLocaleDateString() : 'TBD'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm sm:text-base md:text-lg break-words">
                            {leg.description}
                          </p>
                          <Badge variant="outline" className="text-sm font-bold flex-shrink-0">
                            {(() => {
                              const oddsStr = String(leg.odds).trim()
                              const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
                              if (!isNaN(numOdds) && numOdds > 0 && !oddsStr.startsWith('+')) {
                                return `+${numOdds}`
                              }
                              return leg.odds
                            })()}
                          </Badge>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {leg.result === 'win' && (
                            <p className="text-2xl sm:text-3xl font-bold text-neon-blue">WIN</p>
                          )}
                          {leg.result === 'loss' && (
                            <p className="text-2xl sm:text-3xl font-bold text-destructive">LOSS</p>
                          )}
                          {leg.result === 'push' && (
                            <p className="text-2xl sm:text-3xl font-bold text-gold">PUSH</p>
                          )}
                          {!leg.result && (
                            <p className="text-xl sm:text-2xl font-bold text-muted-foreground">PENDING</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
