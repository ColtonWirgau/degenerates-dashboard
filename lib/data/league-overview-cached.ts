// React-cache()d league overview: the shell layout AND the page both need
// the composite read, and layouts + pages render in the same request —
// cache() dedupes so the queries run once. Lives outside the 'use server'
// module because those may only export async functions.

import { cache } from 'react'
import { getLeagueOverview } from '@/app/actions/league-overview'

export const getLeagueOverviewCached = cache(getLeagueOverview)
