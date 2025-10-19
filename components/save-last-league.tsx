'use client'

import { useEffect } from 'react'
import { saveLastLeague } from '@/lib/last-league'

interface SaveLastLeagueProps {
  leagueId: string
}

/**
 * Client component that saves the league ID to localStorage when mounted.
 * This allows us to remember the last league the user visited.
 */
export function SaveLastLeague({ leagueId }: SaveLastLeagueProps) {
  useEffect(() => {
    saveLastLeague(leagueId)
  }, [leagueId])

  return null
}
