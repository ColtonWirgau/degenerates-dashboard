'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Lock, AlertCircle } from 'lucide-react'
import { createFinalParlay } from '@/app/actions/parlays'

interface Leg {
  id: string
  description: string
  odds: string
  user: {
    raw_user_meta_data?: {
      full_name?: string
    }
    email?: string
  }
}

interface CreateParlayDialogProps {
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
    // Positive odds: (odds / 100) + 1
    return (numOdds / 100) + 1
  } else {
    // Negative odds: (100 / abs(odds)) + 1
    return (100 / Math.abs(numOdds)) + 1
  }
}

// Calculate combined parlay odds
function calculateParlayOdds(selectedLegs: Leg[]): string {
  if (selectedLegs.length === 0) return '+0'

  const decimalOdds = selectedLegs.map(leg => oddsToDecimal(leg.odds))
  const combinedDecimal = decimalOdds.reduce((acc, odd) => acc * odd, 1)
  const americanOdds = Math.round((combinedDecimal - 1) * 100)

  return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`
}

export function CreateParlayDialog({
  weekId,
  leagueId,
  weekNumber,
  legs,
}: CreateParlayDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedLegIds, setSelectedLegIds] = useState<Set<string>>(
    new Set(legs.map(l => l.id))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedLegs = legs.filter(leg => selectedLegIds.has(leg.id))
  const combinedOdds = calculateParlayOdds(selectedLegs)

  const toggleLeg = (legId: string) => {
    setSelectedLegIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(legId)) {
        newSet.delete(legId)
      } else {
        newSet.add(legId)
      }
      return newSet
    })
  }

  const handleSubmit = async () => {
    if (selectedLegs.length === 0) {
      setError('Please select at least one leg')
      return
    }

    setSubmitting(true)
    setError(null)

    console.log('Creating parlay with:', {
      weekId,
      leagueId,
      selectedLegIds: Array.from(selectedLegIds),
      combinedOdds
    })

    try {
      const result = await createFinalParlay(
        weekId,
        leagueId,
        Array.from(selectedLegIds),
        combinedOdds
      )

      console.log('Parlay creation result:', result)

      if (result.error) {
        setError(result.error)
        setSubmitting(false)
      } else {
        // Success! Use router.refresh() instead of hard reload
        setOpen(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Error creating parlay:', error)
      setError('An unexpected error occurred')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="neon-glow-gold">
          <Lock className="h-4 w-4 mr-2" />
          Create Final Parlay & Lock Week
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Final Parlay for Week {weekNumber}</DialogTitle>
          <DialogDescription>
            Select which legs to include in the final parlay. The week will be locked and all picks revealed.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Combined Parlay Odds</h3>
              <Badge variant="outline" className="text-lg text-gold border-gold/30">
                {combinedOdds}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedLegs.length} of {legs.length} legs selected
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Select Legs to Include</h3>
            {legs.map((leg) => (
              <div
                key={leg.id}
                className="glass-card p-4 flex items-start gap-3 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => toggleLeg(leg.id)}
              >
                <Checkbox
                  checked={selectedLegIds.has(leg.id)}
                  onCheckedChange={() => toggleLeg(leg.id)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {leg.user?.raw_user_meta_data?.full_name || leg.user?.email || 'Unknown'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {leg.odds}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{leg.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedLegs.length === 0}
            className="flex-1 neon-glow-gold"
          >
            {submitting ? 'Creating Parlay...' : `Lock Week & Create Parlay (${selectedLegs.length} legs)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
