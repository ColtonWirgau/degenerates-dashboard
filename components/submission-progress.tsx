'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Check, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'

// Compact "X of Y submitted" block with an avatar list. Used in states 1
// (you haven't submitted) and 2 (you have but the parlay isn't full yet).
// Intentionally does NOT show what other people picked — that's the reveal
// moment when the parlay state flips to 'locked'.

interface SubmissionProgressMember {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

interface SubmissionProgressProps {
  total: number
  submittedMembers: SubmissionProgressMember[]
  notSubmittedMembers: SubmissionProgressMember[]
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function SubmissionProgress({
  total,
  submittedMembers,
  notSubmittedMembers,
}: SubmissionProgressProps) {
  const submittedCount = submittedMembers.length
  const pct = total > 0 ? Math.round((submittedCount / total) * 100) : 0

  return (
    <Card className="glass-card">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground">
              Submitted
            </p>
            <p className="text-2xl font-bold text-neon-blue tabular-nums">
              {submittedCount}
              <span className="text-base text-muted-foreground"> / {total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {pct === 100 ? 'Full house' : `${100 - pct}% to go`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-neon-blue to-neon-pink transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Member rows */}
        <div className="space-y-1.5">
          {submittedMembers.map((m) => (
            <MemberRow key={m.userId} member={m} state="in" />
          ))}
          {notSubmittedMembers.map((m) => (
            <MemberRow key={m.userId} member={m} state="out" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function MemberRow({
  member,
  state,
}: {
  member: SubmissionProgressMember
  state: 'in' | 'out'
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg',
        state === 'in' ? 'bg-neon-blue/5' : 'opacity-50'
      )}
    >
      <Avatar className="h-6 w-6">
        <AvatarImage
          src={member.avatarUrl ?? undefined}
          alt={member.fullName ?? member.email}
        />
        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
          {getInitials(member.fullName, member.email)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs flex-1 truncate">
        {member.fullName ?? member.email}
      </span>
      {state === 'in' ? (
        <Check className="h-3.5 w-3.5 text-neon-blue" />
      ) : (
        <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </div>
  )
}
