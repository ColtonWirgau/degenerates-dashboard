'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import {
  closeLeagueSheet,
  subscribeLeagueSheet,
  type LeaguePage,
} from '@/components/chrome/canvas-store'
import { ResponsiveSheet, SheetPage } from '@/components/ui/responsive-sheet'
import { InvitePage, StandingsPage } from '@/components/league-pages'
import { MockPage } from '@/components/user-menu'
import { UserDetailContent, type LeaderboardEntry } from '@/components/leaderboard-sheet'
import { WeekDetailSheet, type WeekDetailData } from '@/components/week-detail-sheet'
import { getUserDetail, type UserDetailPayload } from '@/app/actions/user-detail'
import type { DevToolbarData } from '@/lib/data/dev-toolbar-data'

export interface LeagueSheetProps {
  leagueId: string
  leagueName: string
  memberCount: number
  inviteCode: string
  season: string
  availableSeasons: string[]
  canManage: boolean
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  weeks: WeekDetailData[]
  /** Mock-mode dev controls. Null in production / neon. */
  mock?: DevToolbarData | null
}

/**
 * THE TWO THINGS THAT NEED WIDTH — the full standings table with its
 * per-member drill-in, and the invite flow.
 *
 * Everything else about the league moved out to the season panel, where
 * you can see it without opening anything: the years, the roster, the
 * slate settings. What's left here is what genuinely doesn't fit in a
 * 19rem column, so this stays a portaled sheet. The board panel opens
 * the standings; the roster's "+" opens the invite.
 */
export function LeagueSheet(props: LeagueSheetProps) {
  const [page, setPage] = useState<LeaguePage | null>(null)
  useEffect(() => subscribeLeagueSheet(setPage), [])
  const open = page !== null

  // Which year this answers for is settled outside it, in the season
  // panel — one home for that question, and it reframes the whole app
  // rather than just this surface.
  // Standings drill-in — a member's detail renders as a page *within*
  // this sheet. Week drill from there opens the week sheet on top.
  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [detailSeason, setDetailSeason] = useState<string>(props.season)
  const [detail, setDetail] = useState<UserDetailPayload | null>(null)
  const [detailPending, startDetailTransition] = useTransition()
  const [activeWeek, setActiveWeek] = useState<WeekDetailData | null>(null)

  useEffect(() => {
    if (!open) {
      setDetailUserId(null)
      setDetail(null)
      setDetailSeason(props.season)
      setActiveWeek(null)
    }
  }, [open, props.season])

  useEffect(() => {
    if (!detailUserId) {
      setDetail(null)
      return
    }
    let cancelled = false
    startDetailTransition(async () => {
      const res = await getUserDetail(props.leagueId, detailUserId, detailSeason)
      if (!cancelled) setDetail(res.payload)
    })
    return () => {
      cancelled = true
    }
  }, [detailUserId, detailSeason, props.leagueId])

  return (
    <>
      <ResponsiveSheet
        open={open}
        onClose={closeLeagueSheet}
        defaultPage={page === 'invite' ? 'invite' : 'main'}
        panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
        maxWidth="max-w-3xl"
        sheetMaxHeight="92dvh"
      >
        <SheetPage name="main" title="Standings">
          <StandingsPage
            currentUserId={props.currentUserId}
            leaderboard={props.leaderboard}
            weeks={props.weeks}
            onSelectUser={setDetailUserId}
          />
        </SheetPage>

        <SheetPage name="invite" title="Invite">
          <InvitePage
            leagueId={props.leagueId}
            inviteCode={props.inviteCode}
            canManage={props.canManage}
          />
        </SheetPage>

        {props.mock && (
          <SheetPage name="mock" title="Mock controls">
            <MockPage data={props.mock} />
          </SheetPage>
        )}

        <SheetPage name="user">
          {detailPending && !detail ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="text-neon-blue h-6 w-6 animate-spin" />
            </div>
          ) : detail ? (
            <UserDetailContent
              detail={detail}
              pending={detailPending}
              availableSeasons={props.availableSeasons}
              onSeasonChange={setDetailSeason}
              onOpenLeg={(weekId) => {
                const data = props.weeks.find((w) => w.week.id === weekId)
                if (data) setActiveWeek(data)
              }}
            />
          ) : null}
        </SheetPage>
      </ResponsiveSheet>

      {activeWeek && (
        <WeekDetailSheet
          open={activeWeek !== null}
          onClose={() => setActiveWeek(null)}
          data={activeWeek}
          leagueId={props.leagueId}
          membersCount={props.memberCount}
        />
      )}
    </>
  )
}
