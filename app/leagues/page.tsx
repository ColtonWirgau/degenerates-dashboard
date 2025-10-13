import { getLeagues } from '@/app/actions/leagues'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Plus, Users, Calendar } from 'lucide-react'

export default async function LeaguesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { leagues, error } = await getLeagues()

  return (
    <div className="min-h-screen ambient-glow">
      <Header />

      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neon-blue">My Leagues</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Manage your parlay leagues and track weekly bets
            </p>
          </div>
          <Link href="/leagues/new">
            <Button className="neon-glow-blue group">
              <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" />
              Create League
            </Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-xl glass border-destructive/50 p-4 text-destructive mb-6">
            {error}
          </div>
        )}

        {leagues.length === 0 ? (
          <Card className="glass-intense border-primary/30 neon-glow-blue">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="text-center space-y-6">
                <div className="text-8xl">🎲</div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-neon-blue">No leagues yet</h3>
                  <p className="text-muted-foreground max-w-md">
                    Create your first league to start tracking parlays with your crew
                  </p>
                </div>
                <Link href="/leagues/new">
                  <Button size="lg" className="neon-glow-blue pulse-neon">
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First League
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => {
              const role = league.league_members?.[0]?.role || 'member'
              const roleColor =
                role === 'owner'
                  ? 'text-gold bg-[#FFD700]/10 border-[#FFD700]/30'
                  : role === 'admin'
                  ? 'text-neon-purple bg-[#A855F7]/10 border-[#A855F7]/30'
                  : 'text-neon-blue bg-primary/10 border-primary/30'

              return (
                <Link key={league.id} href={`/leagues/${league.id}`}>
                  <Card className="glass-card hover:glass-intense transition-all hover:neon-glow-blue group cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl group-hover:text-neon-blue transition-colors">
                            {league.name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            <Calendar className="h-3 w-3" />
                            {league.season}
                          </CardDescription>
                        </div>
                        <div
                          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${roleColor}`}
                        >
                          {role}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>View members</span>
                        </div>
                        <span className="text-primary font-medium group-hover:text-neon-blue transition-colors">
                          View →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-center mt-8">
          <Link href="/dashboard">
            <Button variant="outline" className="glass border-primary/30">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
