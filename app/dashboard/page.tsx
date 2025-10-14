import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { TrendingUp, Trophy, Clock } from 'lucide-react'
import { getLeagues } from '@/app/actions/leagues'
import { getDashboardStats } from '@/app/actions/dashboard'
import { LeagueStatsCard } from '@/components/league-stats-card'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has leagues - if only one, redirect to it
  const { leagues } = await getLeagues()
  if (leagues && leagues.length === 1) {
    redirect(`/leagues/${leagues[0].id}`)
  }

  // Get dashboard statistics
  const { leagueCount, activeParlays, winRate, recentActivity } = await getDashboardStats()

  return (
    <div className="min-h-screen ambient-glow">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 pt-20 md:py-8 md:pt-24 main-content">
        {/* Welcome Section */}
        <div className="mb-4 md:mb-8 space-y-1 md:space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">
            Welcome back,{' '}
            <span className="text-neon-blue">{user.user_metadata?.full_name || 'Degenerate'}</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Ready to place some bets? Let&apos;s make it rain.
          </p>
        </div>

        <div className="grid gap-3 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* CTA Card - only show if no leagues */}
          {leagueCount === 0 && (
            <Card className="col-span-full glass-intense border-primary/30 neon-glow-blue overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
              <CardHeader>
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <CardDescription className="text-base">
                  Create your first league and start tracking those degen plays
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/leagues/new">
                  <Button size="lg" className="neon-glow-blue pulse-neon">
                    Create Your First League
                  </Button>
                </Link>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                    <span>Set up your league in seconds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                    <span>Invite your crew</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                    <span>Track weekly parlays and stats</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <LeagueStatsCard leagueCount={leagueCount} leagues={leagues || []} />

          <Card className="glass-card group hover:glass-intense transition-all hover:neon-glow-purple cursor-pointer py-3 gap-3 md:py-6 md:gap-6">
            <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 md:px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Parlays
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-secondary group-hover:text-neon-purple transition-colors" />
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="text-3xl md:text-4xl font-bold text-neon-purple">{activeParlays}</div>
              <p className="text-xs text-muted-foreground mt-1 md:mt-2">
                {activeParlays === 0
                  ? 'No active parlays'
                  : activeParlays === 1
                  ? 'Week in progress'
                  : 'Weeks in progress'}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card group hover:glass-intense transition-all hover:neon-glow-green cursor-pointer py-3 gap-3 md:py-6 md:gap-6">
            <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 md:px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Your Win Rate
              </CardTitle>
              <Trophy className="h-5 w-5 text-[#39FF14] group-hover:text-neon-green transition-colors" />
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="text-3xl md:text-4xl font-bold text-neon-green">{winRate}%</div>
              <p className="text-xs text-muted-foreground mt-1 md:mt-2">
                {winRate === 0 ? 'No completed legs yet' : 'Your personal success rate'}
              </p>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="col-span-full glass-card py-3 gap-3 md:py-6 md:gap-6">
            <CardHeader className="px-4 md:px-6">
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest parlay action</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {!recentActivity || recentActivity.length === 0 ? (
                <div className="text-center py-8 md:py-12 text-muted-foreground">
                  <p className="text-sm">No activity yet. Create a league to get started!</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-4">
                  {recentActivity.map((activity, index) => (
                    <Link
                      key={index}
                      href={`/leagues/${activity.leagueId}/week/${activity.weekId}`}
                      className="flex items-start gap-3 p-2 md:p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {activity.type === 'parlay_result' && (
                          <Trophy
                            className={`h-5 w-5 ${
                              activity.parlayResult === 'win'
                                ? 'text-neon-green'
                                : activity.parlayResult === 'loss'
                                ? 'text-neon-pink'
                                : 'text-yellow-500'
                            }`}
                          />
                        )}
                        {activity.type === 'parlay_locked' && (
                          <TrendingUp className="h-5 w-5 text-neon-purple" />
                        )}
                        {activity.type === 'week_created' && (
                          <Clock className="h-5 w-5 text-neon-blue" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:text-neon-blue transition-colors">
                          {activity.message}
                          {activity.type === 'parlay_result' && (
                            <>
                              :{' '}
                              <span
                                className={`font-semibold ${
                                  activity.parlayResult === 'win'
                                    ? 'text-neon-green'
                                    : activity.parlayResult === 'loss'
                                    ? 'text-neon-pink'
                                    : 'text-yellow-500'
                                }`}
                              >
                                {activity.parlayResult}
                              </span>
                            </>
                          )}
                        </p>
                        {activity.type === 'parlay_result' && activity.userLegResult && (
                          <p className="text-xs mt-1">
                            Your leg:{' '}
                            <span
                              className={`font-semibold ${
                                activity.userLegResult === 'win'
                                  ? 'text-neon-green'
                                  : activity.userLegResult === 'loss'
                                  ? 'text-neon-pink'
                                  : 'text-yellow-500'
                              }`}
                            >
                              {activity.userLegResult}
                            </span>
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav leagueId={leagues?.[0]?.id} />
    </div>
  )
}
