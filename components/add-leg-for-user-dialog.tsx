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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, AlertCircle } from 'lucide-react'
import { submitLegForUser } from '@/app/actions/legs'

interface Member {
  user_id: string
  user: {
    id: string
    email: string
    raw_user_meta_data: {
      full_name?: string
    }
  }
}

interface AddLegForUserDialogProps {
  weekId: string
  leagueId: string
  members: Member[]
  existingLegUserIds: string[]
}

export function AddLegForUserDialog({
  weekId,
  leagueId,
  members,
  existingLegUserIds,
}: AddLegForUserDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [odds, setOdds] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter out users who already have legs and sort by name
  const availableMembers = members
    .filter((m) => !existingLegUserIds.includes(m.user_id))
    .sort((a, b) => {
      const nameA = a.user?.raw_user_meta_data?.full_name || a.user?.email || ''
      const nameB = b.user?.raw_user_meta_data?.full_name || b.user?.email || ''
      return nameA.localeCompare(nameB)
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (!selectedUserId) {
      setError('Please select a user')
      setSubmitting(false)
      return
    }

    const descStr = String(description || '').trim()
    const oddsStr = String(odds || '').trim()

    if (!descStr || !oddsStr) {
      setError('Please fill in all fields')
      setSubmitting(false)
      return
    }

    const result = await submitLegForUser(weekId, leagueId, selectedUserId, {
      description: descStr,
      odds: oddsStr,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setOpen(false)
      setSubmitting(false)
      setSelectedUserId('')
      setDescription('')
      setOdds('')
      // Refresh the page to show the new leg
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="glass border-primary/30">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Leg for Member
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30">
        <DialogHeader>
          <DialogTitle>Add Leg for Member</DialogTitle>
          <DialogDescription>
            Submit a leg on behalf of a league member
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
            <Label htmlFor="user-select">Select Member</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="glass border-primary/30 mt-1">
                <SelectValue placeholder="Choose a member..." />
              </SelectTrigger>
              <SelectContent className="glass-intense border-primary/30">
                {availableMembers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    All members have submitted legs
                  </div>
                ) : (
                  availableMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.user?.raw_user_meta_data?.full_name ||
                        member.user?.email ||
                        'Unknown User'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="add-description">Bet Description</Label>
            <Textarea
              id="add-description"
              placeholder="e.g., Lakers ML vs Celtics, Chiefs -3.5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass border-primary/30 mt-1 resize-none"
              rows={3}
              required
            />
          </div>

          <div>
            <Label htmlFor="add-odds">Odds</Label>
            <Input
              id="add-odds"
              placeholder="e.g., -110, +150"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              className="glass border-primary/30 mt-1"
              inputMode="tel"
              autoComplete="off"
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
              disabled={submitting || availableMembers.length === 0}
              className="flex-1 neon-glow-blue"
            >
              {submitting ? 'Submitting...' : 'Submit Leg'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
