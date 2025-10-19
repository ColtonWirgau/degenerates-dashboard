'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLastLeague } from '@/lib/last-league'

interface LastLeagueRedirectProps {
  leagues: Array<{ id: string }>
}

/**
 * Client component that redirects to the last visited league if:
 * 1. There's a saved league in localStorage
 * 2. The user has multiple leagues
 * 3. The saved league is still in the user's league list
 */
export function LastLeagueRedirect({ leagues }: LastLeagueRedirectProps) {
  const router = useRouter()

  useEffect(() => {
    // Only redirect if user has multiple leagues
    if (leagues.length <= 1) {
      return
    }

    const lastLeagueId = getLastLeague()

    // Check if last league is valid and user is still a member
    if (lastLeagueId && leagues.some(league => league.id === lastLeagueId)) {
      router.replace(`/leagues/${lastLeagueId}`)
    }
  }, [leagues, router])

  return null
}
