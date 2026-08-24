'use client'

import { useEffect, useState, useTransition } from 'react'
import { ChevronRight, Loader2, Users } from 'lucide-react'
import {
  closeLeagueSheet,
  subscribeLeagueSheet,
  type LeaguePage,
} from '@/components/chrome/canvas-store'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import {
  InvitePage,
  SettingsPage,
  StandingsPage,
  type LeagueSheetMember,
} from '@/components/league-pages'
import { LeagueAvatar } from '@/components/league-avatar'
import { SeasonFormStrip } from '@/components/season-form-strip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DevPhaseSwitcher, MockPage } from '@/components/user-menu'
import { UserDetailContent, type LeaderboardEntry } from '@/components/leaderboard-sheet'
import { WeekDetailSheet, type WeekDetailData } from '@/components/week-detail-sheet'
import { getUserDetail, type UserDetailPayload } from '@/app/actions/user-detail'
import type { DevPhaseData, DevToolbarData } from '@/lib/data/dev-toolbar-data'
import { cn } from '@/lib/utils'

const initialsOf = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export interface LeagueSheetProps {
  leagueId: string
  leagueName: string
  memberCount: number
  inviteCode: string
  season: string
  availableSeasons: string[]
  canManage: boolean
  currentUserRole: 'owner' | 'admin' | 'member'
  currentUserId: string
  members: LeagueSheetMember[]
  leaderboard: LeaderboardEntry[]
  weeks: WeekDetailData[]
  /** Index into `weeks` of the in-flight week (active season only). */
  currentWeekIndex: number
  /** Neon-mode dev control — season-phase time travel. Null outside dev. */
  devPhase?: DevPhaseData | null
  /** Mock-mode dev controls. Null in production / neon. Dev tools live
   *  together here rather than being scattered across surfaces. */
  mock?: DevToolbarData | null
}

/**
 * EVERYTHING YOU CAN DO TO THE LEAGUE — members, invites, settings,
 * history, the full table. A portaled sheet rather than a canvas reveal
 * because it's a stack of pages, and a 19rem column can't hold a roster
 * with role menus.
 *
 * Its doorway is the SEASON panel, which is where the league's identity
 * and its years live; each tile there opens this straight onto the page
 * you pressed. The week is not in here (that's the card and the rail),
 * and neither are you (that's your face on the right edge).
 */
export function LeagueSheet(props: LeagueSheetProps) {
  const [page, setPage] = useState<LeaguePage | null>(null)
  useEffect(() => subscribeLeagueSheet(setPage), [])
  const open = page !== null

  // Which year this sheet answers for is settled outside it, in the
  // season panel — one home for that question, and it reframes the whole
  // app rather than just this surface.
  const weeks = props.weeks
  const leaderboard = props.leaderboard

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
        defaultPage={page ?? 'main'}
        panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
        maxWidth="max-w-3xl"
        sheetMaxHeight="92dvh"
      >
        <SheetPage name="main">
          <LeagueMainPage {...props} onSelectUser={setDetailUserId} />
        </SheetPage>

        <SheetPage name="standings" title="Standings">
          <StandingsPage
            currentUserId={props.currentUserId}
            leaderboard={leaderboard}
            weeks={weeks}
            onSelectUser={setDetailUserId}
          />
        </SheetPage>

        <SheetPage name="settings" title="Settings">
          <SettingsPage canManage={props.canManage} leagueId={props.leagueId} />
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
                const data = weeks.find((w) => w.week.id === weekId)
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

/** "2025-2026" → "2025". The span is implied; the year is the name. */
export function seasonLabel(season: string): string {
  return season.split('-')[0] ?? season
}

function LeagueMainPage({
  leagueId,
  leagueName,
  memberCount,
  weeks,
  currentWeekIndex,
  leaderboard,
  currentUserId,
  onSelectUser,
  devPhase,
  mock,
}: LeagueSheetProps & {
  onSelectUser: (userId: string) => void
}) {
  const { navigate } = useResponsiveSheet()

  const handleStandingsTap = (userId: string) => {
    onSelectUser(userId)
    navigate('user')
  }

  // Standings preview — top 3 plus the viewer's row when they sit
  // outside it. The full table lives on the standings page.
  const previewRows = (() => {
    const rows = leaderboard.slice(0, 3).map((m, i) => ({ entry: m, rank: i + 1 }))
    const meIdx = leaderboard.findIndex((m) => m.userId === currentUserId)
    if (meIdx >= 3) rows.push({ entry: leaderboard[meIdx]!, rank: meIdx + 1 })
    return rows
  })()

  return (
    <div className="px-5 pt-2 pb-8 sm:px-6">
      {/* The league — single-tenant, so this states it rather than
          offering a switch. */}
      <div className="flex w-full items-center gap-4 pt-4 pb-5 text-left">
        <LeagueAvatar leagueId={leagueId} size="lg" name={leagueName} />
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-xl leading-tight font-bold break-words">
            {leagueName}
          </h2>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>
      </div>

      {/* How the season has gone. */}
      {weeks.length > 0 && (
        <div className="border-t border-white/10 pt-5">
          <SeasonFormStrip
            weeks={weeks}
            leagueId={leagueId}
            membersCount={memberCount}
            currentWeekIndex={currentWeekIndex}
          />
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="mt-2">
          <p className="text-muted-foreground mb-3 text-[10px] font-bold tracking-[0.25em] uppercase">
            Standings
          </p>
          <div className="space-y-1.5">
            {previewRows.map(({ entry, rank }) => {
              const isMe = entry.userId === currentUserId
              return (
                <button
                  key={entry.userId}
                  type="button"
                  onClick={() => handleStandingsTap(entry.userId)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg border bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:bg-white/[0.04]',
                    isMe
                      ? 'border-neon-blue/40 hover:border-neon-blue/60'
                      : 'border-white/10 hover:border-white/20'
                  )}
                >
                  <span
                    className={cn(
                      'w-7 shrink-0 text-center text-sm leading-none font-bold tabular-nums',
                      rank === 1 ? 'text-neon-blue' : 'text-muted-foreground'
                    )}
                  >
                    #{rank}
                  </span>
                  <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
                    <AvatarImage
                      src={entry.avatarUrl ?? undefined}
                      alt={entry.fullName ?? entry.email}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {initialsOf(entry.fullName, entry.email)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold">
                    {entry.fullName ?? entry.email}
                    {isMe && (
                      <Badge
                        variant="outline"
                        className="border-neon-blue/40 text-neon-blue px-1.5 py-0 text-[10px]"
                      >
                        You
                      </Badge>
                    )}
                  </p>
                  <span className="text-foreground/90 shrink-0 text-sm font-bold tabular-nums">
                    {entry.winRate.toFixed(1)}%
                  </span>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
                </button>
              )
            })}
            {leaderboard.length > previewRows.length && (
              <button
                type="button"
                onClick={() => navigate('standings')}
                className="text-muted-foreground hover:border-neon-blue/30 hover:text-neon-blue group flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors"
              >
                Full standings ({leaderboard.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dev tools, all in one place. */}
      {devPhase && <DevPhaseSwitcher data={devPhase} />}
      {mock && (
        <button
          type="button"
          onClick={() => navigate('mock')}
          className="border-neon-pink/30 bg-neon-pink/5 hover:border-neon-pink/60 hover:bg-neon-pink/10 mt-4 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all"
        >
          <span className="text-neon-pink text-[10px] font-bold tracking-[0.25em] uppercase">
            Mock controls
          </span>
        </button>
      )}
    </div>
  )
}
