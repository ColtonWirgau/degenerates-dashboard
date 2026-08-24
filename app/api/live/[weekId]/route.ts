// Live score state for one NFL week. Polled by clients watching a slate;
// lib/live-scores.ts collapses concurrent callers into one ESPN request.
//
// `weekId` here is the nfl_weeks id (not a parlay id).

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getLiveWeek } from '@/lib/live-scores'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { weekId } = await params
  try {
    const payload = await getLiveWeek(weekId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[api/live] failed:', err)
    return NextResponse.json({ error: 'Live scores unavailable' }, { status: 502 })
  }
}
