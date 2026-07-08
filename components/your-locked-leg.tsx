'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Lock, Trash2 } from 'lucide-react'
import { deleteLeg } from '@/app/actions/legs'

// Used in state 2: open parlay, you've already submitted (and locked) your
// leg. Shows a read-only preview of your pick with a "delete and resubmit"
// action — A1 lifecycle: locked legs are immutable; swap = delete + create.

interface YourLockedLegProps {
  weekId: string
  leagueId: string
  leg: {
    id: string
    description: string
    odds: number
    lockedAt: string | null
  }
  user: {
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
}

const formatOdds = (odds: number): string => (odds > 0 ? `+${odds}` : `${odds}`)

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function YourLockedLeg({ weekId, leagueId, leg, user }: YourLockedLegProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (
      !confirm(
        'Delete your locked leg? You can submit a new one in its place — but only until everyone else locks in.'
      )
    )
      return
    setDeleting(true)
    await deleteLeg(weekId, leg.id, leagueId)
    setDeleting(false)
    router.refresh()
  }

  return (
    <Card className="glass-intense border-neon-blue/40 neon-glow-blue">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-neon-blue">
          <Lock className="h-4 w-4" />
          Your Leg Is Locked
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Your pick is in. Delete it to swap for a different one before kickoff.
        </p>
      </CardHeader>
      <CardContent>
        <div className="glass-card p-4 border border-neon-blue/20">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.avatarUrl ?? undefined}
                alt={user.fullName ?? user.email}
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {getInitials(user.fullName, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm break-words flex-1">
              {user.fullName ?? user.email}
            </span>
          </div>
          <div className="pl-10">
            <p className="text-sm mb-2 break-words">{leg.description}</p>
            <Badge variant="outline" className="text-xs text-neon-blue border-neon-blue/30">
              {formatOdds(leg.odds)}
            </Badge>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full mt-4 border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {deleting ? 'Deleting...' : 'Delete & Resubmit'}
        </Button>
      </CardContent>
    </Card>
  )
}
