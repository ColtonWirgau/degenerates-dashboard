import { getWeek } from '@/app/actions/weeks'
import { getUserLeg, getAllLegsForWeek } from '@/app/actions/legs'
import { getFinalParlay } from '@/app/actions/parlays'
import { getCurrentUserRole } from '@/app/actions/leagues'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitLegForm } from '@/components/submit-leg-form'
import { LiveWeekStatus } from '@/components/live-week-status'
import { EditDeadlineDialog } from '@/components/edit-deadline-dialog'
import { AddLegForUserDialog } from '@/components/add-leg-for-user-dialog'
import { TheLay } from '@/components/the-lay'
import { ParlayResultAnimation } from '@/components/parlay-result-animation'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, Lock, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id: leagueId, weekId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { week } = await getWeek(weekId)
  const { role: currentUserRole } = await getCurrentUserRole(leagueId)
  const { leg: userLeg } = await getUserLeg(weekId)
  const { legs: allLegs } = await getAllLegsForWeek(weekId)
  const { parlay: finalParlay, legs: finalParlayLegs } = await getFinalParlay(weekId)

  // Get all league members for the Add Leg dialog
  const { data: leagueMembersRaw } = await supabase
    .from('league_members')
    .select(`
      user_id,
      user:user_profiles!user_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('league_id', leagueId)

  // Transform the data to handle Supabase's array return type for foreign keys
  const leagueMembers = leagueMembersRaw?.map(member => {
    const user = Array.isArray(member.user) ? member.user[0] : member.user
    return {
      user_id: member.user_id,
      user: user
    }
  }) || []

  if (!week) {
    notFound()
  }

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const deadline = new Date(week.deadline)
  const isPastDeadline = deadline < new Date()
  const isLocked = week.status === 'locked' || week.status === 'closed'

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-5 w-5 text-neon-green" />
      case 'locked':
        return <Lock className="h-5 w-5 text-gold" />
      case 'closed':
        return <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-neon-green bg-[#39FF14]/10 border-[#39FF14]/30'
      case 'locked':
        return 'text-gold bg-[#FFD700]/10 border-[#FFD700]/30'
      case 'closed':
        return 'text-muted-foreground bg-white/5 border-white/10'
      default:
        return ''
    }
  }

  // Get user's leg with result for animation
  const userLegWithResult = userLeg ? allLegs.find(leg => leg.user_id === user?.id) : null

  return (
    <div className="min-h-screen ambient-glow">
      {/* Win/Loss Animation - Only show for non-admins */}
      {isLocked && userLegWithResult && !canManage && (
        <ParlayResultAnimation
          result={userLegWithResult.result as 'win' | 'loss' | 'push' | null}
          userParlay={{ legs: [userLegWithResult] }}
        />
      )}

      <LiveWeekStatus weekId={weekId} initialStatus={week.status} />
      <Header />

      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/leagues/${leagueId}`}>
            <Button variant="outline" size="icon" className="glass border-primary/30">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold">Week {week.week_number}</h1>
              <Badge variant="outline" className={`flex items-center gap-1.5 ${getStatusColor(week.status)}`}>
                {getStatusIcon(week.status)}
                {week.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted-foreground text-lg">
                Deadline: {deadline.toLocaleDateString()} at{' '}
                {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {canManage && week.status === 'open' && (
                <EditDeadlineDialog
                  leagueId={leagueId}
                  weekId={weekId}
                  currentDeadline={week.deadline}
                  weekNumber={week.week_number}
                />
              )}
            </div>
          </div>
        </div>

        {/* User's Leg - Show when submitted */}
        {week.status === 'open' && userLeg && (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Your Leg
              </CardTitle>
              <CardDescription>
                Your submission for Week {week.week_number}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmitLegForm
                weekId={weekId}
                leagueId={leagueId}
                existingLeg={{
                  description: userLeg.description,
                  odds: userLeg.odds,
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Submission Form - Only show if user hasn't submitted yet */}
        {week.status === 'open' && !userLeg && (
          <div className="mb-6">
            {isPastDeadline && !canManage && (
              <Card className="glass-intense border-gold/50 mb-4">
                <CardContent className="pt-6 pb-4 text-center">
                  <p className="text-sm text-gold">
                    ⏰ Deadline has passed. Waiting for admin to lock the week.
                  </p>
                </CardContent>
              </Card>
            )}
            <SubmitLegForm
              weekId={weekId}
              leagueId={leagueId}
              existingLeg={undefined}
            />
            {canManage && isPastDeadline && (
              <Card className="glass-intense border-primary/30 mt-4">
                <CardContent className="pt-6 pb-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    💡 As an admin, you can still submit even after the deadline. You can also extend the deadline above.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Add Leg for Member Button */}
        {canManage && week.status === 'open' && (
          <div className="mb-6">
            <AddLegForUserDialog
              weekId={weekId}
              leagueId={leagueId}
              members={leagueMembers}
              existingLegUserIds={allLegs.map(leg => leg.user_id)}
            />
          </div>
        )}

        {/* The Lay - Unified component for all legs (locked and unlocked) */}
        <TheLay
          weekId={weekId}
          leagueId={leagueId}
          weekNumber={week.week_number}
          initialLegs={isLocked ? finalParlayLegs : allLegs}
          members={leagueMembers}
          currentUserId={user?.id || ''}
          canManage={canManage}
          isLocked={isLocked}
          parlayId={finalParlay?.id}
          totalOdds={finalParlay?.total_odds}
        />
      </main>
    </div>
  )
}
