'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { closeWeekAndCreateNext } from '@/app/actions/weeks'
import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type CloseWeekButtonProps = {
  leagueId: string
  weekId: string
  weekNumber: number
}

export function CloseWeekButton({ leagueId, weekId, weekNumber }: CloseWeekButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClose = async () => {
    setLoading(true)
    setError(null)

    const result = await closeWeekAndCreateNext(leagueId, weekId)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setOpen(false)
      setLoading(false)
      router.push(`/leagues/${leagueId}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="neon-glow-gold">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Close Week
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card">
        <DialogHeader>
          <DialogTitle>Close Week {weekNumber}?</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>This will:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Mark Week {weekNumber} as closed</li>
              <li>Prevent any further changes to Week {weekNumber}</li>
              <li>Create Week {weekNumber + 1} with a deadline on the next Sunday at 9:15 AM (if it doesn&apos;t exist)</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              This action cannot be undone.
            </p>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClose}
            disabled={loading}
            className="neon-glow-gold"
          >
            {loading ? 'Closing...' : 'Close Week'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
