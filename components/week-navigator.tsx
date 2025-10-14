'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { WeekStatsChart } from '@/components/week-stats-chart'
import { WeekResults } from '@/components/week-results'
import { SubmissionStatsChart } from '@/components/submission-stats-chart'
import { InlineLegSubmission } from '@/components/inline-leg-submission'
import { ChevronLeft, ChevronRight, Clock, PlusCircle } from 'lucide-react'
import Link from 'next/link'

type Week = {
  id: string
  week_number: number
  deadline: string
  status: 'open' | 'locked' | 'closed'
  season: string
}

type UserLeg = {
  id: string
  user_id: string
  result: string | null
  odds?: string
  description?: string
}

type UserInfo = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

type WeekData = {
  week: Week
  submissionCount: number
  userLeg: UserLeg | null
  weekStats: {
    wins: number
    losses: number
    pushes: number
    pending: number
  }
  winners: UserInfo[]
  losers: UserInfo[]
  submittedUsers: UserInfo[]
  notSubmittedUsers: UserInfo[]
}

type WeekNavigatorProps = {
  leagueId: string
  allWeeksData: WeekData[]
  currentWeekIndex: number
  canManage: boolean
  membersCount: number
  currentUserId: string
}

export function WeekNavigator({
  leagueId,
  allWeeksData,
  currentWeekIndex: initialIndex,
  canManage,
  membersCount,
  currentUserId,
}: WeekNavigatorProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const currentWeekData = allWeeksData[currentIndex]
  const { week, submissionCount, userLeg, weekStats, winners, losers, submittedUsers, notSubmittedUsers } = currentWeekData

  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < allWeeksData.length - 1
  const isOnLastWeek = currentIndex === allWeeksData.length - 1

  const deadline = new Date(week.deadline)
  const isPastDeadline = deadline < new Date()
  const isLocked = week.status === 'locked' || week.status === 'closed'

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (canGoNext) {
      setCurrentIndex(currentIndex + 1)
    }
  }

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

  return (
    <Card className="glass-intense border-primary/30 neon-glow-blue mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Navigation Arrows */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="shrink-0 disabled:opacity-30"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-2xl sm:text-3xl">Week {week.week_number}</CardTitle>
              <CardDescription className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm sm:text-base">
                {isLocked ? (
                  // Show fun message based on outcome when locked
                  weekStats.wins > weekStats.losses ? (
                    <span className="text-neon-blue font-medium">🔥 The boys are eatin&apos; tonight!</span>
                  ) : weekStats.losses > weekStats.wins ? (
                    <span className="text-neon-pink font-medium">💀 The parlay is cooked boys</span>
                  ) : weekStats.wins === weekStats.losses && weekStats.wins > 0 ? (
                    <span className="text-gold font-medium">😬 Saved by the bell</span>
                  ) : (
                    <span className="text-muted-foreground font-medium">⏳ Results pending...</span>
                  )
                ) : (
                  <>
                    {deadline && (
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          Deadline: {deadline.toLocaleDateString()} at{' '}
                          {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    )}
                    {isPastDeadline && (
                      <Badge variant="outline" className="text-destructive border-destructive/30 w-fit">
                        Deadline Passed
                      </Badge>
                    )}
                  </>
                )}
              </CardDescription>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={!canGoNext}
              className="shrink-0 disabled:opacity-30"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          <Link href={`/leagues/${leagueId}/weeks/${week.id}`} className="shrink-0 w-full sm:w-auto">
            <Button className="neon-glow-blue w-full sm:w-auto">
              View Details
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* This Week's Stats */}
        {week.status === 'open' ? (
          // When open: grid layout similar to locked state
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 lg:grid-rows-2">
            {/* Submission Stats Chart - spans 2 rows on large screens */}
            <div className="lg:row-span-2">
              <SubmissionStatsChart
                submitted={submissionCount}
                notSubmitted={membersCount - submissionCount}
                total={membersCount}
              />
            </div>

            {/* Your Leg - spans 2 columns on large screens */}
            <div className="lg:col-span-2 glass-card p-4">
              <p className="text-xs text-muted-foreground mb-3">Your Leg</p>
              <InlineLegSubmission
                weekId={week.id}
                leagueId={leagueId}
                existingLeg={userLeg ? {
                  description: userLeg.description || '',
                  odds: userLeg.odds || '',
                } : undefined}
                currentUserId={currentUserId}
              />
            </div>

            {/* Locked In - Who submitted */}
            <div className="glass-card p-4 lg:col-span-1">
              <p className="text-neon-blue font-bold text-sm mb-3 uppercase tracking-wide">🔒 Locked In</p>
              {submittedUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No one has submitted yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {submittedUsers.map((user) => (
                    <Avatar key={user.userId} className="h-12 w-12 border-2 border-neon-blue/50">
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.fullName || user.email} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                        {getInitials(user.fullName, user.email)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </div>

            {/* Slackers - Who hasn't submitted */}
            <div className="glass-card p-4 lg:col-span-1">
              <p className="text-muted-foreground font-bold text-sm mb-3 uppercase tracking-wide">😴 Slackers</p>
              {notSubmittedUsers.length === 0 ? (
                <p className="text-xs text-neon-blue">Everyone&apos;s in! 🎉</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {notSubmittedUsers.map((user) => (
                    <Avatar key={user.userId} className="h-12 w-12 border-2 border-muted/50 opacity-60">
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.fullName || user.email} />
                      <AvatarFallback className="bg-muted/20 text-muted-foreground font-bold text-xs">
                        {getInitials(user.fullName, user.email)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // When locked: complex grid layout
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 lg:grid-rows-2">
            {/* Chart - spans 2 rows on large screens */}
            <div className="lg:row-span-2">
              <WeekStatsChart
                wins={weekStats.wins}
                losses={weekStats.losses}
                pushes={weekStats.pushes}
                pending={weekStats.pending}
              />
            </div>

            {/* Your Leg - spans 2 columns on large screens */}
            <Card className={`lg:col-span-2 glass-card hover:glass-intense transition-all py-3 gap-0 md:py-6 ${
              userLeg?.result === 'win' ? 'hover:neon-glow-blue border-neon-blue/30' :
              userLeg?.result === 'loss' ? 'hover:neon-glow-pink border-destructive/30' :
              userLeg?.result === 'push' ? 'hover:neon-glow-gold border-gold/30' :
              'border-primary/20'
            }`}>
              <CardContent className="px-4 md:px-6 h-full">
                {userLeg ? (
                  <div className="h-full flex flex-col">
                    <p className="text-xs text-muted-foreground mb-2">Your Leg</p>
                    <div className="flex-1 flex items-center">
                      <div className="flex items-center justify-between gap-4 w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-base md:text-lg font-medium text-foreground break-words">
                            {userLeg.description || 'No description'}
                          </p>
                          <Badge variant="outline" className="text-sm font-bold flex-shrink-0">
                            {(() => {
                              const oddsStr = String(userLeg.odds).trim()
                              const numOdds = parseInt(oddsStr.replace(/[^-\d]/g, ''))
                              if (!isNaN(numOdds) && numOdds > 0 && !oddsStr.startsWith('+')) {
                                return `+${numOdds}`
                              }
                              return userLeg.odds
                            })()}
                          </Badge>
                        </div>

                        {userLeg.result && (
                          <div className="flex-shrink-0">
                            {userLeg.result === 'win' && (
                              <p className="text-2xl sm:text-3xl font-bold text-neon-blue">WIN</p>
                            )}
                            {userLeg.result === 'loss' && (
                              <p className="text-2xl sm:text-3xl font-bold text-destructive">LOSS</p>
                            )}
                            {userLeg.result === 'push' && (
                              <p className="text-2xl sm:text-3xl font-bold text-gold">PUSH</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Your Leg</p>
                    <p className="text-base md:text-lg font-bold text-muted-foreground">None</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Champions Circle and Graveyard */}
            <WeekResults winners={winners} losers={losers} compact />
          </div>
        )}

        {/* Create Week Prompt (only for admins on last week) */}
        {isOnLastWeek && canManage && week.status !== 'open' && (
          <div className="mt-6 p-4 glass-card border-primary/30 rounded-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="font-medium text-foreground">Ready for the next week?</p>
                <p className="text-sm text-muted-foreground">Create a new week to continue the action</p>
              </div>
              <Link href={`/leagues/${leagueId}/history`}>
                <Button className="neon-glow-gold">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Week
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
