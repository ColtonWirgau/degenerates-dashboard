'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { LeagueSelectorDialog } from '@/components/league-selector-dialog'

interface League {
  id: string
  name: string
  league_members: Array<{ role: string }>
}

interface LeagueStatsCardProps {
  leagueCount: number
  leagues: League[]
}

export function LeagueStatsCard({ leagueCount, leagues }: LeagueStatsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleClick = () => {
    if (leagueCount > 0) {
      setDialogOpen(true)
    }
  }

  return (
    <>
      <Card
        className="glass-card group hover:glass-intense transition-all hover:neon-glow-blue cursor-pointer py-3 gap-3 md:py-6 md:gap-6"
        onClick={handleClick}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 md:px-6">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Your Leagues
          </CardTitle>
          <Users className="h-5 w-5 text-primary group-hover:text-neon-blue transition-colors" />
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="text-3xl md:text-4xl font-bold text-neon-blue">{leagueCount}</div>
          <p className="text-xs text-muted-foreground mt-1 md:mt-2">
            {leagueCount === 0
              ? 'No leagues yet - time to create one'
              : leagueCount === 1
              ? 'League membership'
              : 'League memberships'}
          </p>
        </CardContent>
      </Card>

      <LeagueSelectorDialog leagues={leagues} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
