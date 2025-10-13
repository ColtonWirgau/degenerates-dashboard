'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Lock, Unlock, Trash2, Check, X, Minus, Users } from 'lucide-react'
import { deleteLeg } from '@/app/actions/legs'
import { createFinalParlay, updateLegResult } from '@/app/actions/parlays'
import { EditLegDialog } from '@/components/edit-leg-dialog'

interface Leg {
  id: string
  description: string
  odds: string
  user_id: string
  leg_number: number
  result: string | null
  created_at: string
  user: {
    id: string
    email: string
    raw_user_meta_data: {
      full_name?: string
      avatar_url?: string
    }
  }
}

interface Member {
  user_id: string
  user: {
    id: string
    email: string
    raw_user_meta_data: {
      full_name?: string
      avatar_url?: string
    }
  }
}

interface TheLayProps {
  weekId: string
  leagueId: string
  weekNumber: number
  initialLegs: Leg[]
  members: Member[]
  currentUserId: string
  canManage: boolean
  isLocked: boolean
  parlayId?: string
  totalOdds?: string | null
}

// Convert odds to decimal for calculation
function oddsToDecimal(odds: string): number {
  const oddsStr = String(odds || '').trim()
  const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
  if (isNaN(numOdds)) return 1

  if (numOdds > 0) {
    return (numOdds / 100) + 1
  } else {
    return (100 / Math.abs(numOdds)) + 1
  }
}

// Calculate combined parlay odds
function calculateParlayOdds(legs: Leg[]): string {
  if (legs.length === 0) return '+0'

  const decimalOdds = legs.map(leg => oddsToDecimal(leg.odds))
  const combinedDecimal = decimalOdds.reduce((acc, odd) => acc * odd, 1)
  const americanOdds = Math.round((combinedDecimal - 1) * 100)

  return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`
}

export function TheLay({
  weekId,
  leagueId,
  weekNumber,
  initialLegs,
  members,
  currentUserId,
  canManage,
  isLocked,
  parlayId,
  totalOdds,
}: TheLayProps) {
  const router = useRouter()
  const [legs, setLegs] = useState(initialLegs)
  const [locking, setLocking] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [updatingLegId, setUpdatingLegId] = useState<string | null>(null)
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
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
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
                  const updated = [...prev]
                  updated[existingIndex] = newLeg
                  return updated
                } else {
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

  const handleLock = async () => {
    if (legs.length === 0) return

    if (!confirm(`Lock Week ${weekNumber} with ${legs.length} leg${legs.length === 1 ? '' : 's'}? This will reveal all picks to the league.`)) {
      return
    }

    setLocking(true)
    const combinedOdds = calculateParlayOdds(legs)
    const legIds = legs.map(leg => leg.id)

    const result = await createFinalParlay(weekId, leagueId, legIds, combinedOdds)

    if (!result.error) {
      router.refresh()
    } else {
      setLocking(false)
      alert(result.error)
    }
  }

  const handleUnlock = async () => {
    if (!parlayId) return

    if (!confirm('Are you sure you want to unlock this week? Picks will become hidden again.')) {
      return
    }

    setUnlocking(true)
    const { unlockWeekAndDeleteParlay } = await import('@/app/actions/parlays')
    const result = await unlockWeekAndDeleteParlay(weekId, leagueId, parlayId)

    if (!result.error) {
      router.refresh()
    } else {
      setUnlocking(false)
      alert(result.error)
    }
  }

  const handleUpdateResult = async (legId: string, result: 'win' | 'loss' | 'push') => {
    setUpdatingLegId(legId)
    await updateLegResult(leagueId, weekId, legId, result)
    setUpdatingLegId(null)
    router.refresh()
  }

  const getResultBadge = (result: string | null) => {
    if (!result) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-white/10">
          Pending
        </Badge>
      )
    }

    switch (result) {
      case 'win':
        return (
          <Badge variant="outline" className="text-neon-green border-neon-green/30">
            Win
          </Badge>
        )
      case 'loss':
        return (
          <Badge variant="outline" className="text-destructive border-destructive/30">
            Loss
          </Badge>
        )
      case 'push':
        return (
          <Badge variant="outline" className="text-gold border-gold/30">
            Push
          </Badge>
        )
      default:
        return null
    }
  }

  // Get members who haven't submitted
  const membersWithLegs = new Set(legs.map(leg => leg.user_id))
  const missingMembers = members.filter(m => !membersWithLegs.has(m.user_id))

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              The Lay
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              {legs.length} of {members.length} legs submitted
              {!isLocked && (
                <span className="inline-flex items-center gap-1.5 ml-3">
                  <span className="h-2 w-2 rounded-full bg-neon-green animate-pulse" />
                  <span className="text-xs text-neon-green">LIVE</span>
                </span>
              )}
              {isLocked && totalOdds && (
                <Badge variant="outline" className="ml-2 text-gold border-gold/30">
                  {totalOdds}
                </Badge>
              )}
            </p>
          </div>
          {canManage && (
            <div>
              {isLocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {unlocking ? 'Unlocking...' : 'Unlock'}
                </Button>
              ) : (
                <Button
                  onClick={handleLock}
                  disabled={locking || legs.length === 0}
                  size="sm"
                  className="neon-glow-gold"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  {locking ? 'Locking...' : 'Lock'}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {legs.map((leg) => {
            const getResultStyles = () => {
              if (!isLocked || !leg.result) return ''

              switch (leg.result) {
                case 'win':
                  return 'bg-neon-green/20 border-neon-green border-2 shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                case 'loss':
                  return 'bg-destructive/20 border-destructive border-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                case 'push':
                  return 'bg-gold/20 border-gold border-2 shadow-[0_0_20px_rgba(255,215,0,0.3)]'
                default:
                  return ''
              }
            }

            return (
              <div
                key={leg.id}
                className={`glass-card p-4 transition-all relative ${
                  newLegId === leg.id
                    ? 'animate-in fade-in slide-in-from-right-4 neon-glow-green border-neon-green/50'
                    : getResultStyles()
                }`}
              >
                {/* Top Right - Outcome Badge */}
                {isLocked && (
                  <div className="absolute top-3 right-3">
                    {getResultBadge(leg.result)}
                  </div>
                )}

                {/* User Info */}
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={leg.user?.raw_user_meta_data?.avatar_url} alt={leg.user?.raw_user_meta_data?.full_name || leg.user?.email} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {getInitials(
                        leg.user?.raw_user_meta_data?.full_name || null,
                        leg.user?.email || ''
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">
                    {leg.user?.raw_user_meta_data?.full_name || leg.user?.email || 'Unknown'}
                  </span>
                </div>

                {/* Leg Details */}
                <div className="pl-10 mb-2">
                  <p className={`text-sm mb-1 ${
                    isLocked && leg.result === 'win' ? 'text-neon-green' :
                    isLocked && leg.result === 'loss' ? 'text-destructive' :
                    isLocked && leg.result === 'push' ? 'text-gold' :
                    ''
                  }`}>
                    {leg.description}
                  </p>
                  <Badge variant="outline" className={`text-xs ${
                    isLocked && leg.result === 'win' ? 'text-neon-green border-neon-green/30' :
                    isLocked && leg.result === 'loss' ? 'text-destructive border-destructive/30' :
                    isLocked && leg.result === 'push' ? 'text-gold border-gold/30' :
                    ''
                  }`}>
                    {(() => {
                      const oddsStr = String(leg.odds).trim()
                      const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
                      if (!isNaN(numOdds) && numOdds > 0 && !oddsStr.startsWith('+')) {
                        return `+${numOdds}`
                      }
                      return leg.odds
                    })()}
                  </Badge>
                </div>

                {/* Bottom Right - Action Buttons */}
                {isLocked && canManage && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1">
                    <Button
                      size="icon"
                      onClick={() => handleUpdateResult(leg.id, 'win')}
                      disabled={updatingLegId === leg.id}
                      className={`h-8 w-8 rounded ${
                        leg.result === 'win'
                          ? 'bg-[#39FF14] text-black hover:bg-[#39FF14] hover:text-black'
                          : 'bg-transparent text-neon-green hover:text-neon-green hover:bg-neon-green/10 border-[0.5px] border-[#39FF14]'
                      }`}
                      title="Win"
                    >
                      <Check className="h-5 w-5 stroke-[3]" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={() => handleUpdateResult(leg.id, 'loss')}
                      disabled={updatingLegId === leg.id}
                      className={`h-8 w-8 rounded ${
                        leg.result === 'loss'
                          ? 'bg-destructive text-black hover:bg-destructive hover:text-black'
                          : 'bg-transparent text-destructive hover:text-destructive hover:bg-destructive/10 border-[0.5px] border-destructive'
                      }`}
                      title="Loss"
                    >
                      <X className="h-5 w-5 stroke-[3]" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={() => handleUpdateResult(leg.id, 'push')}
                      disabled={updatingLegId === leg.id}
                      className={`h-8 w-8 rounded ${
                        leg.result === 'push'
                          ? 'bg-[#FFD700] text-black hover:bg-[#FFD700] hover:text-black'
                          : 'bg-transparent text-gold hover:text-gold hover:bg-gold/10 border-[0.5px] border-[#FFD700]'
                      }`}
                      title="Push"
                    >
                      <Minus className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                )}

                {/* Unlocked Edit/Delete Buttons */}
                {!isLocked && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
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
                )}
              </div>
          )})}

          {legs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No legs submitted yet. Be the first!
            </p>
          )}

          {/* Show missing members when unlocked */}
          {!isLocked && missingMembers.length > 0 && (
            <div className="glass-card p-4 border-gold/30">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-gold mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gold mb-1">
                    Waiting on {missingMembers.length} member{missingMembers.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {missingMembers.map(m => m.user?.raw_user_meta_data?.full_name || m.user?.email).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
