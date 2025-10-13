import { getLeague } from '@/app/actions/leagues'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, TrendingUp, Trophy, Calendar } from 'lucide-react'
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

  // Get all weeks for current season
  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, status, deadline')
    .eq('league_id', leagueId)
    .eq('season', currentSeason.id)
    .order('week_number', { ascending: false })

  if (!weeks) {
    notFound()
  }

  const weekIds = weeks.map(w => w.id)

  // Get all user's legs for current season
  const { data: userLegs } = await supabase
    .from('parlay_legs')
    .select(`
      id,
      description,
      odds,
      result,
      created_at,
      week_id,
      week:weeks!week_id (
        week_number,
        deadline,
        status
      )
    `)
    .in('week_id', weekIds)
    .eq('user_id', userId)

  // Sort by week deadline in descending order (most recent first)
  const sortedLegs = userLegs?.sort((a, b) => {
    // Type guard: Supabase returns week as an array but we know it's always a single object due to the foreign key
    const weekA = Array.isArray(a.week) ? a.week[0] : a.week
    const weekB = Array.isArray(b.week) ? b.week[0] : b.week
    const dateA = new Date(weekA.deadline).getTime()
    const dateB = new Date(weekB.deadline).getTime()
    return dateB - dateA
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
            <div className="flex flex-col items-center gap-6">
              {/* Win Rate - Featured at top on mobile */}
              <div className="text-center w-full">
                <div className="text-6xl font-bold text-neon-blue mb-2">
                  {winRate.toFixed(1)}%
                </div>
                <p className="text-base text-muted-foreground">Win Rate</p>
              </div>

              {/* Avatar and User Info */}
              <div className="flex flex-col items-center gap-3 w-full">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} alt={fullName} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-2xl">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="text-center w-full px-2">
                  <h1 className="text-2xl font-bold text-neon-blue mb-2 break-words">{fullName}</h1>
                  <p className="text-sm text-muted-foreground">{league.name}</p>
                  <p className="text-sm text-muted-foreground">{currentSeason.displayName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
          <Card className="glass-card hover:glass-intense transition-all hover:neon-glow-green">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Wins</p>
                  <p className="text-3xl font-bold text-neon-green">{stats.wins}</p>
                </div>
                <Trophy className="h-8 w-8 text-neon-green" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:glass-intense transition-all hover:neon-glow-pink">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Losses</p>
                  <p className="text-3xl font-bold text-destructive">{stats.losses}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-destructive rotate-180" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:glass-intense transition-all hover:neon-glow-gold">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pushes</p>
                  <p className="text-3xl font-bold text-gold">{stats.pushes}</p>
                </div>
                <Calendar className="h-8 w-8 text-gold" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:glass-intense transition-all">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Record</p>
                <p className="text-2xl font-bold text-foreground whitespace-nowrap">
                  {stats.wins}W - {stats.losses}L
                </p>
                <p className="text-xs text-muted-foreground">{stats.total} total</p>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  // Type guard: Supabase returns week as an array but we know it's always a single object due to the foreign key
                  const week = Array.isArray(leg.week) ? leg.week[0] : leg.week
                  const resultColor =
                    leg.result === 'win' ? 'text-neon-green border-neon-green/30 bg-neon-green/5' :
                    leg.result === 'loss' ? 'text-destructive border-destructive/30 bg-destructive/5' :
                    leg.result === 'push' ? 'text-gold border-gold/30 bg-gold/5' :
                    'text-muted-foreground border-muted-foreground/30'

                  return (
                    <div
                      key={leg.id}
                      className={`glass-card hover:glass-intense transition-all p-3 sm:p-4 border ${resultColor}`}
                    >
                      <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="text-center flex-shrink-0 min-w-[60px] sm:min-w-[80px]">
                            <p className="text-xs text-muted-foreground mb-1">Week</p>
                            <p className="text-xl sm:text-2xl font-bold text-primary">{week.week_number}</p>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm sm:text-base md:text-lg mb-1 break-words">
                              {leg.description}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <Badge variant="outline" className="text-xs w-fit">
                                {leg.odds}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(week.deadline).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {leg.result === 'win' && (
                            <div>
                              <p className="text-xl sm:text-2xl font-bold text-neon-green">WIN</p>
                              <p className="text-xs text-neon-green">✓</p>
                            </div>
                          )}
                          {leg.result === 'loss' && (
                            <div>
                              <p className="text-xl sm:text-2xl font-bold text-destructive">LOSS</p>
                              <p className="text-xs text-destructive">✗</p>
                            </div>
                          )}
                          {leg.result === 'push' && (
                            <div>
                              <p className="text-xl sm:text-2xl font-bold text-gold">PUSH</p>
                              <p className="text-xs text-gold">—</p>
                            </div>
                          )}
                          {!leg.result && (
                            <div>
                              <p className="text-lg sm:text-xl font-bold text-muted-foreground">Pending</p>
                              <p className="text-xs text-muted-foreground">⏳</p>
                            </div>
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
