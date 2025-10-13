import { getLeague, getCurrentUserRole, getLeagueMembers } from '@/app/actions/leagues'
import { getWeeks, getWeekSubmissionCounts } from '@/app/actions/weeks'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateWeekDialog } from '@/components/create-week-dialog'
import { WeekCard } from '@/components/week-card'
import { formatSeason } from '@/lib/seasons'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { league, error: leagueError } = await getLeague(id)
  const { members, error: membersError } = await getLeagueMembers(id)
  const { role: currentUserRole } = await getCurrentUserRole(id)
  const { weeks } = await getWeeks(id)
  const submissionCounts = await getWeekSubmissionCounts(weeks.map(w => w.id))

  if (leagueError || !league) {
    notFound()
  }

  const canManageWeeks = currentUserRole === 'owner' || currentUserRole === 'admin'
  const nextWeekNumber = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1

  // Group weeks by season
  interface Week {
    id: string
    week_number: number
    status: 'open' | 'locked' | 'closed'
    deadline: string
    season: string
    created_at: string
  }
  const weeksBySeason: Record<string, Week[]> = {}
  weeks.forEach(week => {
    const season = week.season || '2025-2026' // Default for weeks without season
    if (!weeksBySeason[season]) {
      weeksBySeason[season] = []
    }
    weeksBySeason[season].push(week)
  })

  // Sort seasons in descending order (most recent first)
  const sortedSeasons = Object.keys(weeksBySeason).sort().reverse()

  return (
    <div className="min-h-screen ambient-glow">
      <Header />

      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/leagues/${id}`}>
            <Button variant="outline" size="icon" className="glass border-primary/30">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-neon-blue">{league.name}</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Week History
            </p>
          </div>
        </div>

        {/* Weekly Parlays - Grouped by Season */}
        {weeks.length === 0 ? (
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Weeks</CardTitle>
                  <CardDescription>Browse all weeks and their results</CardDescription>
                </div>
                {canManageWeeks && (
                  <CreateWeekDialog leagueId={id} nextWeekNumber={nextWeekNumber} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 space-y-4">
                <div className="text-6xl">🎰</div>
                <div>
                  <p className="text-muted-foreground text-sm mb-2">
                    No weeks created yet. {canManageWeeks ? 'Create your first week to get started!' : 'Ask an admin to create a week.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedSeasons.map((season) => (
              <Card key={season} className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{formatSeason(season)}</CardTitle>
                      <CardDescription>
                        {weeksBySeason[season].length} {weeksBySeason[season].length === 1 ? 'week' : 'weeks'}
                      </CardDescription>
                    </div>
                    {canManageWeeks && season === sortedSeasons[0] && (
                      <CreateWeekDialog leagueId={id} nextWeekNumber={nextWeekNumber} />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {weeksBySeason[season].map((week) => (
                      <WeekCard
                        key={week.id}
                        week={week}
                        leagueId={id}
                        canManage={canManageWeeks}
                        submissionCount={submissionCounts[week.id] || 0}
                        totalMembers={members.length}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
