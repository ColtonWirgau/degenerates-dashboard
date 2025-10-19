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
import { Calendar, Edit } from 'lucide-react'
import { updateWeekDeadline } from '@/app/actions/weeks'

interface EditDeadlineDialogProps {
  leagueId: string
  weekId: string
  currentDeadline: string
  weekNumber: number
}

export function EditDeadlineDialog({
  leagueId,
  weekId,
  currentDeadline,
  weekNumber,
}: EditDeadlineDialogProps) {
  const [open, setOpen] = useState(false)
  const [deadline, setDeadline] = useState(() => {
    // Convert UTC timestamp to local datetime-local format
    const date = new Date(currentDeadline)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  })
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setUpdating(true)

    // Convert datetime-local to ISO string with timezone
    // datetime-local returns "YYYY-MM-DDTHH:mm" in local time
    // We need to create a Date object and convert to ISO with timezone
    const [datePart, timePart] = deadline.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute] = timePart.split(':').map(Number)
    const localDate = new Date(year, month - 1, day, hour, minute)
    const isoString = localDate.toISOString()

    const result = await updateWeekDeadline(leagueId, weekId, isoString)

    if (result.error) {
      setError(result.error)
      setUpdating(false)
    } else {
      setOpen(false)
      setUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <Edit className="h-3 w-3 mr-1" />
          Edit Deadline
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30">
        <DialogHeader>
          <DialogTitle>Edit Deadline - Week {weekNumber}</DialogTitle>
          <DialogDescription>
            Extend or change the submission deadline for this week
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="deadline" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              New Submission Deadline
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
              disabled={updating}
              className="flex-1 neon-glow-blue"
            >
              {updating ? 'Updating...' : 'Update Deadline'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
