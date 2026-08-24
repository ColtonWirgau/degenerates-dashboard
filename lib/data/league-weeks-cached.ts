// React-cache()d week list. The shell layout needs it (to build the rail
// and the dock) and so does every week page (to resolve which week it is)
// — and both render in the same request, so cache() makes that one round
// trip instead of two.

import { cache } from 'react'
import {
  getLeagueWeeks,
  pickCurrentWeek,
  type LeagueWeekRow,
} from '@/lib/data/league-weeks'

export const getLeagueWeeksCached = cache(
  async (
    leagueId: string,
    season: string
  ): Promise<{ weeks: LeagueWeekRow[]; currentWeek: LeagueWeekRow | null }> => {
    const weeks = await getLeagueWeeks(leagueId, season)
    return { weeks, currentWeek: await pickCurrentWeek(weeks) }
  }
)
