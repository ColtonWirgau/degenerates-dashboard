'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditLegDialog } from '@/components/edit-leg-dialog'
import { List, Trash2 } from 'lucide-react'
import { deleteLeg } from '@/app/actions/legs'

interface Leg {
  id: string
  description: string
  odds: string
  user_id: string
  validation_status: string
  validation_message: string | null
  created_at: string
  user: {
    id: string
    email: string
    raw_user_meta_data: {
      full_name?: string
    }
  }
}

interface AllLegsDisplayProps {
  weekId: string
  leagueId: string
  initialLegs: Leg[]
  currentUserId: string
  canManage: boolean
}

export function AllLegsDisplay({
  weekId,
  leagueId,
  initialLegs,
  currentUserId,
  canManage,
}: AllLegsDisplayProps) {
  const [legs, setLegs] = useState(initialLegs)
  const [newLegId, setNewLegId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Set up realtime subscription for new legs
    const channel = supabase
      .channel(`week_${weekId}_legs`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parlay_legs',
          filter: `week_id=eq.${weekId}`,
        },
        async (payload) => {
          console.log('Leg change detected:', payload)

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the updated leg with user info
            const { data: newLeg } = await supabase
              .from('parlay_legs')
              .select(`
                *,
                user:user_profiles!user_id (
                  id,
                  email,
                  raw_user_meta_data
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newLeg) {
              setLegs((prev) => {
                const existingIndex = prev.findIndex((l) => l.id === newLeg.id)
                if (existingIndex >= 0) {
                  // Update existing
                  const updated = [...prev]
                  updated[existingIndex] = newLeg
                  return updated
                } else {
                  // Add new with animation trigger
                  setNewLegId(newLeg.id)
                  setTimeout(() => setNewLegId(null), 2000)
                  return [...prev, newLeg]
                }
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setLegs((prev) => prev.filter((l) => l.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [weekId, supabase])

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

  const handleDelete = async (legId: string) => {
    if (!confirm('Are you sure you want to delete this leg?')) return
    await deleteLeg(weekId, legId, leagueId)
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5 text-primary" />
          All Submitted Legs
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-neon-green animate-pulse" />
            <span className="text-xs text-neon-green font-normal">LIVE</span>
          </div>
        </CardTitle>
        <CardDescription>
          {legs.length} {legs.length === 1 ? 'leg' : 'legs'} submitted • Owner will combine into final parlay
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* TODO: Re-enable AI validation when OpenAI quota is fixed */}
        {/* {canManage && weekStatus === 'open' && legs.length > 0 && (
          <div className="mb-4">
            <ValidateLegsButton weekId={weekId} leagueId={leagueId} legCount={legs.length} />
          </div>
        )} */}

        <div className="space-y-3">
          {legs.map((leg) => (
            <div
              key={leg.id}
              className={`glass-card p-4 transition-all ${
                newLegId === leg.id
                  ? 'animate-in fade-in slide-in-from-right-4 neon-glow-green border-neon-green/50'
                  : ''
              }`}
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
                  {/* TODO: Re-enable validation badges when AI validation is back */}
                  {/* {getValidationBadge(leg.validation_status)} */}
                  {canManage && (
                    <EditLegDialog
                      legId={leg.id}
                      weekId={weekId}
                      leagueId={leagueId}
                      currentDescription={leg.description}
                      currentOdds={leg.odds}
                      userName={leg.user?.raw_user_meta_data?.full_name || leg.user?.email || 'User'}
                    />
                  )}
                  {(canManage || leg.user_id === currentUserId) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(leg.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
              No legs submitted yet. Be the first!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
