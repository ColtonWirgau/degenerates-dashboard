'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface WeekResultsProps {
  winners: Array<{
    userId: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }>
  losers: Array<{
    userId: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }>
  compact?: boolean
}

export function WeekResults({ winners, losers, compact = false }: WeekResultsProps) {
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

  if (compact) {
    // Compact mode: just avatars in a single row each
    return (
      <>
        {/* Champions Circle */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-neon-blue mb-3">Champions</h3>
          {winners.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No winners yet</p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-start">
              {winners.map((winner) => (
                <Avatar key={winner.userId} className="h-12 w-12 border-2 border-neon-blue/50">
                  <AvatarImage src={winner.avatarUrl || undefined} alt={winner.fullName || winner.email} />
                  <AvatarFallback className="bg-neon-blue text-primary-foreground text-base font-bold">
                    {getInitials(winner.fullName, winner.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>

        {/* Graveyard */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-neon-pink mb-3">Graveyard</h3>
          {losers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No losses yet</p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-start">
              {losers.map((loser) => (
                <Avatar key={loser.userId} className="h-12 w-12 border-2 border-destructive/50">
                  <AvatarImage src={loser.avatarUrl || undefined} alt={loser.fullName || loser.email} />
                  <AvatarFallback className="bg-destructive text-white text-base font-bold">
                    {getInitials(loser.fullName, loser.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Champions Circle */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-neon-blue mb-3">Champions</h3>
        {winners.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No winners yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {winners.map((winner) => (
              <div
                key={winner.userId}
                className="flex items-center gap-2 bg-neon-blue/10 border border-neon-blue/30 rounded-full px-3 py-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={winner.avatarUrl || undefined} alt={winner.fullName || winner.email} />
                  <AvatarFallback className="bg-neon-blue text-primary-foreground text-xs font-bold">
                    {getInitials(winner.fullName, winner.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-neon-blue">
                  {winner.fullName || winner.email.split('@')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Graveyard */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-neon-pink mb-3">Graveyard</h3>
        {losers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No losses yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {losers.map((loser) => (
              <div
                key={loser.userId}
                className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-full px-3 py-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={loser.avatarUrl || undefined} alt={loser.fullName || loser.email} />
                  <AvatarFallback className="bg-destructive text-white text-xs font-bold">
                    {getInitials(loser.fullName, loser.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-destructive">
                  {loser.fullName || loser.email.split('@')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
