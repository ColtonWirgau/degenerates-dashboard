'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface RecentLeg {
  id: string
  description: string
  odds: string
  result: 'win' | 'loss' | 'push' | null
  week_number: number
  week_id: string
}

interface RecentLegsProps {
  legs: RecentLeg[]
  leagueId: string
  userId?: string
  maxDisplay?: number
  showViewAll?: boolean
}

export function RecentLegs({ legs, leagueId, userId, maxDisplay = 5, showViewAll = false }: RecentLegsProps) {
  const displayLegs = legs.slice(0, maxDisplay)
  const hasMore = showViewAll || legs.length > maxDisplay

  return (
    <div className="glass-card p-4 flex flex-col">
      <p className="text-xs text-muted-foreground mb-3">Recent Legs</p>
      {legs.length === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground py-8">
          <p className="text-sm">No legs submitted yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayLegs.map((leg) => (
              <Link
                key={leg.id}
                href={`/leagues/${leagueId}/weeks/${leg.week_id}`}
                className="block"
              >
                <div className={`glass-card hover:glass-intense transition-all p-3 cursor-pointer ${
                  leg.result === 'win' ? 'hover:neon-glow-blue border-neon-blue/20' :
                  leg.result === 'loss' ? 'hover:neon-glow-pink border-destructive/20' :
                  leg.result === 'push' ? 'hover:neon-glow-gold border-gold/20' :
                  'border-primary/10'
                }`}>
                  <span className="text-xs text-muted-foreground">Week {leg.week_number}</span>
                  <div className="flex items-center justify-between gap-4 mt-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground break-words line-clamp-2">
                        {leg.description || 'No description'}
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

                    {leg.result && (
                      <div className="text-right flex-shrink-0">
                        {leg.result === 'win' && (
                          <p className="text-xl font-bold text-neon-blue">WIN</p>
                        )}
                        {leg.result === 'loss' && (
                          <p className="text-xl font-bold text-destructive">LOSS</p>
                        )}
                        {leg.result === 'push' && (
                          <p className="text-xl font-bold text-gold">PUSH</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && userId && (
            <Link href={`/leagues/${leagueId}/users/${userId}`} className="block mt-4">
              <Button variant="outline" className="w-full glass border-primary/30">
                See All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
        </>
      )}
    </div>
  )
}
