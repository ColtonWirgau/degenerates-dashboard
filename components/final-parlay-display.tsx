'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Lock, TrendingUp, Unlock, AlertCircle, Check, X, Minus } from 'lucide-react'
import { unlockWeekAndDeleteParlay, updateLegResult } from '@/app/actions/parlays'

interface Leg {
  id: string
  description: string
  odds: string
  leg_number: number
  result: string | null
  user_id: string
  user: {
    id: string
    email: string
    raw_user_meta_data: {
      full_name?: string
    }
  }
}

interface FinalParlayDisplayProps {
  parlay: {
    id: string
    total_odds: string | null
    status: string
    created_at: string
    week_id: string
  }
  legs: Leg[]
  weekId: string
  leagueId: string
  canManage: boolean
}

export function FinalParlayDisplay({ parlay, legs, weekId, leagueId, canManage }: FinalParlayDisplayProps) {
  const router = useRouter()
  const [unlocking, setUnlocking] = useState(false)
  const [updatingLegId, setUpdatingLegId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUnlock = async () => {
    if (!confirm('Are you sure you want to unlock this week? This will delete the final parlay and allow members to edit their legs again.')) {
      return
    }

    setUnlocking(true)
    setError(null)

    const result = await unlockWeekAndDeleteParlay(weekId, leagueId, parlay.id)

    if (result.error) {
      setError(result.error)
      setUnlocking(false)
    } else {
      // Success! Use router.refresh() instead of hard reload
      router.refresh()
    }
  }

  const handleUpdateResult = async (legId: string, result: 'win' | 'loss' | 'push') => {
    setUpdatingLegId(legId)
    setError(null)

    const updateResult = await updateLegResult(leagueId, weekId, legId, result)

    if (updateResult.error) {
      setError(updateResult.error)
    } else {
      router.refresh()
    }

    setUpdatingLegId(null)
  }
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

  const getResultBadge = (result: string | null) => {
    if (!result) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-white/10">
          Pending
        </Badge>
      )
    }

    switch (result) {
      case 'win':
        return (
          <Badge variant="outline" className="text-neon-green border-neon-green/30">
            Win
          </Badge>
        )
      case 'loss':
        return (
          <Badge variant="outline" className="text-destructive border-destructive/30">
            Loss
          </Badge>
        )
      case 'push':
        return (
          <Badge variant="outline" className="text-gold border-gold/30">
            Push
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-gold" />
              Final Parlay
              <Badge variant="outline" className="text-gold border-gold/30">
                <TrendingUp className="h-3 w-3 mr-1" />
                {parlay.total_odds || 'N/A'}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1.5">
              {legs.length} {legs.length === 1 ? 'leg' : 'legs'} selected for the final parlay
            </CardDescription>
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlock}
              disabled={unlocking}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Unlock className="h-4 w-4 mr-2" />
              {unlocking ? 'Unlocking...' : 'Unlock Week'}
            </Button>
          )}
        </div>
        {error && (
          <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive flex items-start gap-2 mt-3">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {legs.map((leg) => (
            <div
              key={leg.id}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                    {getInitials(
                      leg.user?.raw_user_meta_data?.full_name || null,
                      leg.user?.email || ''
                    )}
                  </div>
                  <span className="font-medium text-sm">
                    {leg.user?.raw_user_meta_data?.full_name || leg.user?.email || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getResultBadge(leg.result)}
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatingLegId === leg.id}
                          className="h-8 px-2"
                        >
                          {updatingLegId === leg.id ? 'Updating...' : 'Set Result'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-intense border-primary/30">
                        <DropdownMenuItem onClick={() => handleUpdateResult(leg.id, 'win')}>
                          <Check className="h-4 w-4 mr-2 text-neon-green" />
                          Win
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateResult(leg.id, 'loss')}>
                          <X className="h-4 w-4 mr-2 text-destructive" />
                          Loss
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateResult(leg.id, 'push')}>
                          <Minus className="h-4 w-4 mr-2 text-gold" />
                          Push
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="pl-10">
                <p className="text-sm mb-1">{leg.description}</p>
                <Badge variant="outline" className="text-xs">
                  {leg.odds}
                </Badge>
              </div>
            </div>
          ))}

          {legs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No legs in final parlay
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
