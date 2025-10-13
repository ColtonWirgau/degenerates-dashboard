'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Clock,
  Lock,
  CheckCircle2,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Users,
} from 'lucide-react'
import { updateWeekStatus, deleteWeek } from '@/app/actions/weeks'
import Link from 'next/link'

interface Week {
  id: string
  week_number: number
  deadline: string
  status: 'open' | 'locked' | 'closed'
  created_at: string
}

interface WeekCardProps {
  week: Week
  leagueId: string
  canManage: boolean
  submissionCount?: number
  totalMembers?: number
}

export function WeekCard({
  week,
  leagueId,
  canManage,
  submissionCount = 0,
  totalMembers = 0,
}: WeekCardProps) {
  const [updating, setUpdating] = useState(false)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4 text-neon-green" />
      case 'locked':
        return <Lock className="h-4 w-4 text-gold" />
      case 'closed':
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
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
        return 'text-muted-foreground bg-white/5 border-white/10'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open for Submissions'
      case 'locked':
        return 'Locked - Reveal Time!'
      case 'closed':
        return 'Closed'
      default:
        return status
    }
  }

  const handleStatusChange = async (newStatus: 'open' | 'locked' | 'closed') => {
    setUpdating(true)
    await updateWeekStatus(leagueId, week.id, newStatus)
    setUpdating(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete Week ${week.week_number}? This will remove all parlay data for this week.`)) {
      return
    }

    setUpdating(true)
    await deleteWeek(leagueId, week.id)
    setUpdating(false)
  }

  const deadline = new Date(week.deadline)
  const now = new Date()
  const isPastDeadline = deadline < now
  const timeUntilDeadline = deadline.getTime() - now.getTime()
  const hoursUntil = Math.floor(timeUntilDeadline / (1000 * 60 * 60))
  const daysUntil = Math.floor(hoursUntil / 24)

  const getTimeUntilText = () => {
    if (isPastDeadline) return 'Deadline passed'
    if (daysUntil > 0) return `${daysUntil}d ${hoursUntil % 24}h left`
    if (hoursUntil > 0) return `${hoursUntil}h left`
    return 'Less than 1h left'
  }

  return (
    <Card className="glass-card hover:glass-intense transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl">Week {week.week_number}</CardTitle>
            <Badge
              variant="outline"
              className={`flex items-center gap-1.5 ${getStatusColor(week.status)}`}
            >
              {getStatusIcon(week.status)}
              {getStatusLabel(week.status)}
            </Badge>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={updating}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-intense border-primary/30">
                {week.status !== 'open' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('open')}>
                    <Clock className="h-4 w-4 mr-2 text-neon-green" />
                    Reopen Week
                  </DropdownMenuItem>
                )}
                {week.status !== 'locked' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('locked')}>
                    <Lock className="h-4 w-4 mr-2 text-gold" />
                    Lock & Reveal
                  </DropdownMenuItem>
                )}
                {week.status !== 'closed' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    Close Week
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Week
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Deadline Info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Deadline:</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {deadline.toLocaleDateString()} at {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {week.status === 'open' && (
              <Badge variant="outline" className={isPastDeadline ? 'text-destructive' : 'text-gold'}>
                {getTimeUntilText()}
              </Badge>
            )}
          </div>
        </div>

        {/* Submission Progress */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Submissions:
          </span>
          <span className="font-medium">
            {submissionCount} / {totalMembers}
          </span>
        </div>

        {/* View Details Button */}
        <Link href={`/leagues/${leagueId}/weeks/${week.id}`} className="block">
          <Button className="w-full neon-glow-blue mt-2" variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            {week.status === 'locked' ? 'View Reveals' : 'View Details'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
