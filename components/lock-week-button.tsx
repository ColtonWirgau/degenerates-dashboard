'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Lock, AlertCircle } from 'lucide-react'
import { createFinalParlay } from '@/app/actions/parlays'

interface Leg {
  id: string
  description: string
  odds: string
}

interface LockWeekButtonProps {
  weekId: string
  leagueId: string
  weekNumber: number
  legs: Leg[]
}

// Convert odds to decimal for calculation
function oddsToDecimal(odds: string): number {
  const oddsStr = String(odds || '').trim()
  const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
  if (isNaN(numOdds)) return 1

  if (numOdds > 0) {
    return (numOdds / 100) + 1
  } else {
    return (100 / Math.abs(numOdds)) + 1
  }
}

// Calculate combined parlay odds
function calculateParlayOdds(legs: Leg[]): string {
  if (legs.length === 0) return '+0'

  const decimalOdds = legs.map(leg => oddsToDecimal(leg.odds))
  const combinedDecimal = decimalOdds.reduce((acc, odd) => acc * odd, 1)
  const americanOdds = Math.round((combinedDecimal - 1) * 100)

  return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`
}

export function LockWeekButton({
  weekId,
  leagueId,
  weekNumber,
  legs,
}: LockWeekButtonProps) {
  const router = useRouter()
  const [locking, setLocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLock = async () => {
    if (legs.length === 0) {
      setError('No legs submitted yet')
      setTimeout(() => setError(null), 3000)
      return
    }

    if (!confirm(`Lock Week ${weekNumber} with ${legs.length} leg${legs.length === 1 ? '' : 's'}? This will reveal all picks to the league.`)) {
      return
    }

    setLocking(true)
    setError(null)

    const combinedOdds = calculateParlayOdds(legs)
    const legIds = legs.map(leg => leg.id)

    try {
      const result = await createFinalParlay(
        weekId,
        leagueId,
        legIds,
        combinedOdds
      )

      if (result.error) {
        setError(result.error)
        setLocking(false)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error locking week:', error)
      setError('An unexpected error occurred')
      setLocking(false)
    }
  }

  return (
    <div>
      <Button
        onClick={handleLock}
        disabled={locking || legs.length === 0}
        className="neon-glow-gold"
      >
        <Lock className="h-4 w-4 mr-2" />
        {locking ? 'Locking...' : `Lock Week (${legs.length})`}
      </Button>
      {error && (
        <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive flex items-start gap-2 mt-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
