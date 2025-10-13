'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

interface Parlay {
  id: string
  user_id: string
  created_at: string
  legs: any[]
}

interface User {
  id: string
  email: string
  raw_user_meta_data: {
    full_name?: string
  }
}

interface LiveSubmissionStatusProps {
  weekId: string
  initialParlays: any[]
}

export function LiveSubmissionStatus({ weekId, initialParlays }: LiveSubmissionStatusProps) {
  const [parlays, setParlays] = useState(initialParlays)
  const [newSubmission, setNewSubmission] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Set up realtime subscription for parlays
    const channel = supabase
      .channel(`week_${weekId}_parlays`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parlays',
          filter: `week_id=eq.${weekId}`,
        },
        async (payload) => {
          console.log('Parlay change detected:', payload)

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the updated parlay with user info
            const { data: newParlay } = await supabase
              .from('parlays')
              .select(`
                *,
                user:user_id (
                  id,
                  email,
                  raw_user_meta_data
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newParlay) {
              // Fetch legs for this parlay
              const { data: legs } = await supabase
                .from('parlay_legs')
                .select('*')
                .eq('parlay_id', newParlay.id)
                .order('leg_number', { ascending: true })

              const parlayWithLegs = {
                ...newParlay,
                legs: legs || [],
              }

              setParlays((prev) => {
                const existingIndex = prev.findIndex((p) => p.id === newParlay.id)
                if (existingIndex >= 0) {
                  // Update existing
                  const updated = [...prev]
                  updated[existingIndex] = parlayWithLegs
                  return updated
                } else {
                  // Add new with animation trigger
                  setNewSubmission(newParlay.id)
                  setTimeout(() => setNewSubmission(null), 2000)
                  return [...prev, parlayWithLegs]
                }
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setParlays((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [weekId, supabase])

  return (
    <Card className="glass-card sticky top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Submission Status
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-neon-green animate-pulse" />
            <span className="text-xs text-neon-green font-normal">LIVE</span>
          </div>
        </CardTitle>
        <CardDescription>Who's locked in?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {parlays.map((parlay) => (
            <div
              key={parlay.id}
              className={`flex items-center justify-between p-3 glass-card transition-all ${
                newSubmission === parlay.id
                  ? 'animate-in fade-in slide-in-from-right-4 neon-glow-green border-neon-green/50'
                  : ''
              }`}
            >
              <span className="text-sm font-medium">
                {parlay.user?.raw_user_meta_data?.full_name || parlay.user?.email || 'Unknown'}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-neon-green border-neon-green/30">
                  {parlay.legs.length} legs
                </Badge>
                <span className="text-neon-green text-xl">✓</span>
              </div>
            </div>
          ))}

          {parlays.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No submissions yet. Be the first!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
