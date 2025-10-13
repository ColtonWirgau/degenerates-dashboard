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
import { Textarea } from '@/components/ui/textarea'
import { Pencil, AlertCircle } from 'lucide-react'
import { updateLegAsAdmin } from '@/app/actions/legs'

interface EditLegDialogProps {
  legId: string
  weekId: string
  leagueId: string
  currentDescription: string
  currentOdds: string
  userName: string
}

export function EditLegDialog({
  legId,
  weekId,
  leagueId,
  currentDescription,
  currentOdds,
  userName,
}: EditLegDialogProps) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState(currentDescription)
  const [odds, setOdds] = useState(currentOdds)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const descStr = String(description || '').trim()
    const oddsStr = String(odds || '').trim()

    if (!descStr || !oddsStr) {
      setError('Please fill in all fields')
      setSubmitting(false)
      return
    }

    const result = await updateLegAsAdmin(weekId, legId, leagueId, {
      description: descStr,
      odds: oddsStr,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setOpen(false)
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-primary hover:text-primary"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30">
        <DialogHeader>
          <DialogTitle>Edit {userName}&apos;s Leg</DialogTitle>
          <DialogDescription>
            Update this leg as an admin/owner
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="edit-description">Bet Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass border-primary/30 mt-1 resize-none"
              rows={3}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-odds">Odds</Label>
            <Input
              id="edit-odds"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              className="glass border-primary/30 mt-1"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 neon-glow-blue"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
