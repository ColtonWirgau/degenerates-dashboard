'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ParlayLeg {
  id: string
  leg_number: number
  description: string
  odds: string
  result: 'win' | 'loss' | 'push' | null
}

interface ParlayRevealCardProps {
  userName: string
  userInitials: string
  legs: ParlayLeg[]
  isRevealed: boolean
  revealDelay?: number
}

export function ParlayRevealCard({
  userName,
  userInitials,
  legs,
  isRevealed,
  revealDelay = 0,
}: ParlayRevealCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [visibleLegs, setVisibleLegs] = useState<number[]>([])

  useEffect(() => {
    if (isRevealed) {
      // Flip the card after delay
      const flipTimer = setTimeout(() => {
        setIsFlipped(true)
      }, revealDelay)

      // Reveal legs one by one
      const legTimers = legs.map((_, index) => {
        return setTimeout(() => {
          setVisibleLegs((prev) => [...prev, index])
        }, revealDelay + 800 + index * 200)
      })

      return () => {
        clearTimeout(flipTimer)
        legTimers.forEach(clearTimeout)
      }
    }
  }, [isRevealed, revealDelay, legs])

  const allWins = legs.every((leg) => leg.result === 'win')
  const hasLoss = legs.some((leg) => leg.result === 'loss')
  const parlayResult = allWins ? 'win' : hasLoss ? 'loss' : 'pending'

  const getResultIcon = (result: string | null) => {
    switch (result) {
      case 'win':
        return <TrendingUp className="h-4 w-4 text-neon-green" />
      case 'loss':
        return <TrendingDown className="h-4 w-4 text-destructive" />
      case 'push':
        return <Minus className="h-4 w-4 text-gold" />
      default:
        return null
    }
  }

  const getResultColor = (result: string | null) => {
    switch (result) {
      case 'win':
        return 'text-neon-green bg-[#39FF14]/10 border-[#39FF14]/30'
      case 'loss':
        return 'text-destructive bg-destructive/10 border-destructive/30'
      case 'push':
        return 'text-gold bg-[#FFD700]/10 border-[#FFD700]/30'
      default:
        return 'text-muted-foreground bg-white/5 border-white/10'
    }
  }

  return (
    <div className="perspective-1000">
      <div
        className={`relative transition-transform duration-700 transform-style-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Card Back (Hidden State) */}
        <Card
          className={`glass-intense border-primary/30 backface-hidden ${
            isFlipped ? 'invisible' : 'visible'
          }`}
        >
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-2xl animate-pulse">
              {userInitials}
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{userName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {legs.length} Legs Locked In
              </p>
            </div>
            <div className="text-4xl">🔒</div>
          </CardContent>
        </Card>

        {/* Card Front (Revealed State) */}
        <Card
          className={`absolute inset-0 glass-intense border-primary/30 backface-hidden rotate-y-180 ${
            parlayResult === 'win' ? 'neon-glow-green border-neon-green/50' : ''
          } ${parlayResult === 'loss' ? 'border-destructive/50' : ''} ${
            isFlipped ? 'visible' : 'invisible'
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                  {userInitials}
                </div>
                <CardTitle className="text-xl">{userName}</CardTitle>
              </div>
              {parlayResult === 'win' && (
                <Trophy className="h-6 w-6 text-neon-green animate-bounce" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {legs.map((leg, index) => (
              <div
                key={leg.id}
                className={`glass-card p-3 transition-all duration-500 ${
                  visibleLegs.includes(index)
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-4'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary">
                        Leg {leg.leg_number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {leg.odds}
                      </Badge>
                    </div>
                    <p className="text-sm break-words">{leg.description}</p>
                  </div>
                  {leg.result && (
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 ${getResultColor(
                        leg.result
                      )}`}
                    >
                      {getResultIcon(leg.result)}
                      {leg.result.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  )
}
