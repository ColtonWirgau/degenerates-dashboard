import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { TrendingUp, Users, Trophy } from 'lucide-react'
import { getLeagues } from '@/app/actions/leagues'

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

  return (
    <div className="min-h-screen ambient-glow">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pt-24 main-content">
        {/* Welcome Section */}
        <div className="mb-8 space-y-2">
          <h2 className="text-4xl font-bold">
            Welcome back,{' '}
            <span className="text-neon-blue">{user.user_metadata?.full_name || 'Degenerate'}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Ready to place some bets? Let's make it rain.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* CTA Card */}
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

          {/* Stats Cards */}
          <Card className="glass-card group hover:glass-intense transition-all hover:neon-glow-blue cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Your Leagues
              </CardTitle>
              <Users className="h-5 w-5 text-primary group-hover:text-neon-blue transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-neon-blue">0</div>
              <p className="text-xs text-muted-foreground mt-2">
                No leagues yet - time to create one
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card group hover:glass-intense transition-all hover:neon-glow-purple cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Parlays
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-secondary group-hover:text-neon-purple transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-neon-purple">0</div>
              <p className="text-xs text-muted-foreground mt-2">
                No active parlays
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card group hover:glass-intense transition-all hover:neon-glow-green cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Win Rate
              </CardTitle>
              <Trophy className="h-5 w-5 text-[#39FF14] group-hover:text-neon-green transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-neon-green">--%</div>
              <p className="text-xs text-muted-foreground mt-2">
                No data yet
              </p>
            </CardContent>
          </Card>

          {/* Recent Activity Placeholder */}
          <Card className="col-span-full glass-card">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest parlay action</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No activity yet. Create a league to get started!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav leagueId={leagues?.[0]?.id} />
    </div>
  )
}
