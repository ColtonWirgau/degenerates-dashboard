'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'

interface League {
  id: string
  name: string
  league_members: Array<{ role: string }>
}

interface LeagueSelectorDialogProps {
  leagues: League[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeagueSelectorDialog({ leagues, open, onOpenChange }: LeagueSelectorDialogProps) {
  const router = useRouter()

  const handleSelectLeague = (leagueId: string) => {
    onOpenChange(false)
    router.push(`/leagues/${leagueId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-intense border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select a League</DialogTitle>
          <DialogDescription>Choose which league you want to view</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {leagues.map((league) => {
            const role = league.league_members[0]?.role
            return (
              <Button
                key={league.id}
                onClick={() => handleSelectLeague(league.id)}
                variant="outline"
                className="w-full justify-start h-auto py-4 glass-card hover:glass-intense hover:neon-glow-blue transition-all group"
              >
                <div className="flex items-center gap-3 w-full">
                  <Users className="h-5 w-5 text-neon-blue group-hover:text-primary transition-colors" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-base">{league.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{role}</div>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
