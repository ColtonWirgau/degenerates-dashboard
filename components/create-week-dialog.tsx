'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Calendar } from 'lucide-react'
import { createWeek } from '@/app/actions/weeks'

interface CreateWeekDialogProps {
  leagueId: string
  nextWeekNumber: number
}

export function CreateWeekDialog({ leagueId, nextWeekNumber }: CreateWeekDialogProps) {
  const [open, setOpen] = useState(false)
  const [weekNumber, setWeekNumber] = useState(nextWeekNumber)
  const [deadline, setDeadline] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreating(true)

    // Convert datetime-local to ISO string with timezone
    const [datePart, timePart] = deadline.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute] = timePart.split(':').map(Number)
    const localDate = new Date(year, month - 1, day, hour, minute)
    const isoString = localDate.toISOString()

    const formData = new FormData()
    formData.append('week_number', weekNumber.toString())
    formData.append('deadline', isoString)

    const result = await createWeek(leagueId, formData)

    if (result.error) {
      setError(result.error)
      setCreating(false)
    } else {
      setOpen(false)
      setWeekNumber(nextWeekNumber + 1)
      setDeadline('')
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="neon-glow-green">
          <Plus className="h-4 w-4 mr-2" />
          Create Week
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30">
        <DialogHeader>
          <DialogTitle>Create New Week</DialogTitle>
          <DialogDescription>
            Set up a new week for your league members to submit their parlay legs
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="week_number" className="text-sm font-medium">
              Week Number
            </Label>
            <Input
              id="week_number"
              type="number"
              min="1"
              value={weekNumber}
              onChange={(e) => setWeekNumber(parseInt(e.target.value))}
              className="glass border-primary/30 mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="deadline" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Submission Deadline
            </Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="glass border-primary/30 mt-1"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Members can submit legs until this time
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 glass border-primary/30"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating}
              className="flex-1 neon-glow-green"
            >
              {creating ? 'Creating...' : 'Create Week'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
