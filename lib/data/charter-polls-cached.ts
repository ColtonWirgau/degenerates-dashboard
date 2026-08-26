// The charter's polls, fetched once per request.
//
// Every vote the charter can hold lives on the preseason week — that's
// the week league business belongs to, and app/actions/charter.ts is the
// only thing that attaches a poll to an entry. So "the charter's polls"
// is one query against one week.
//
// Two surfaces need it now and they render in the same request: the
// preseason page (which lays the ballot out) and the shell layout (which
// hands them to the RULES panel, so paging into an item can show its
// vote instead of sending you somewhere else). cache() makes that one
// round trip rather than two.

import { cache } from 'react'
import { getDataAdapter } from '@/lib/data/adapter'
import type { LeaguePoll } from '@/lib/data/mock-polls'
import { isMockData } from '@/lib/data/data-source'

export const getCharterPollsCached = cache(
  async (leagueId: string, preseasonWeekId: string): Promise<LeaguePoll[]> => {
    if (!preseasonWeekId) return []
    if (isMockData()) return []
    const adapter = await getDataAdapter()
    return adapter.getPolls(leagueId, {
      statuses: ['open', 'closed'],
      nflWeekId: preseasonWeekId,
    })
  }
)
