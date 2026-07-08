import { getLeagues } from '@/app/actions/leagues'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDevToolbarData, getDevPhaseData } from '@/lib/data/dev-toolbar-data'
import { UserMenu } from '@/components/user-menu'
import { LeagueBarTrigger } from '@/components/league-bar-trigger'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'
import type { LeagueSheetMember } from '@/components/league-sheet'
import Link from 'next/link'

interface LeagueBarProps {
  leagueId: string
  leagueName: string
  memberCount: number
  season: string
  inviteCode: string
  canManage: boolean
  weeks: WeekDetailData[]
  currentWeekIndex: number
  members: LeagueSheetMember[]
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  availableSeasons: string[]
}

/**
 * League-page top bar. Same shape as the site `<Header />` (brand on the
 * left, user-menu avatar on the right) — adds a small league chip to the
 * right that opens the League sheet. Replaces the giant league-title `<h1>`
 * the league page used to render under the header.
 */
export async function LeagueBar(props: LeagueBarProps) {
  const me = await getCurrentUser()
  const [{ leagues }, mock, devPhase] = await Promise.all([
    me ? getLeagues() : Promise.resolve({ leagues: [] }),
    getDevToolbarData(),
    getDevPhaseData(),
  ])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-primary/20">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <Link href="/" className="group shrink-0">
          <h1 className="font-bold leading-none flex items-center whitespace-nowrap sm:gap-2">
            <span className="relative z-10 text-neon-blue group-hover:text-primary transition-colors text-3xl sm:text-2xl tracking-[-0.18em] sm:tracking-tight">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DEGENERATES</span>
            </span>
            <span className="relative z-0 text-neon-pink group-hover:text-neon-blue transition-colors text-3xl sm:text-2xl tracking-tight">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DASHBOARD</span>
            </span>
          </h1>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <LeagueBarTrigger
            leagueId={props.leagueId}
            leagueName={props.leagueName}
            memberCount={props.memberCount}
            season={props.season}
            inviteCode={props.inviteCode}
            canManage={props.canManage}
            weeks={props.weeks}
            currentWeekIndex={props.currentWeekIndex}
            members={props.members}
            currentUserId={props.currentUserId}
            leaderboard={props.leaderboard}
            availableSeasons={props.availableSeasons}
          />
          {me && <UserMenu user={me} leagues={leagues} mock={mock} devPhase={devPhase} />}
        </div>
      </div>
    </header>
  )
}
