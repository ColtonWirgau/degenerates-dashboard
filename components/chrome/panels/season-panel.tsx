'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  History,
  Link2,
  Loader2,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react'
import { closePanel, openLeagueSheet, type LeaguePage } from '@/components/chrome/canvas-store'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import { LeagueAvatar } from '@/components/league-avatar'
import { setViewSeason } from '@/app/actions/view-season'
import { cn } from '@/lib/utils'

/**
 * THE SEASON — which year the whole app is answering for.
 *
 * Tapping a year switches to it, full stop. There's no preview-then-
 * commit two-step: a list where tapping a row does something *other*
 * than the obvious thing is a list that feels broken, and looking at
 * last year is the entire reason this panel exists.
 *
 * Underneath, the doors to the league itself. They open the league
 * sheet — too many pages for a reveal this narrow — straight onto the
 * page you asked for.
 */
export function SeasonPanel({ availableSeasons }: { availableSeasons: string[] }) {
  const chrome = useLeagueChrome()
  const router = useRouter()
  const [pending, start] = useTransition()

  if (!chrome) return null

  const pick = (season: string) => {
    if (season === chrome.season) {
      closePanel()
      return
    }
    start(async () => {
      // Picking the calendar's own season clears the pin rather than
      // freezing you on it.
      await setViewSeason(season === availableSeasons[0] ? null : season)
      router.refresh()
      closePanel()
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        Season
      </p>

      <div className="mb-6 shrink-0 space-y-1.5">
        {availableSeasons.map((s) => {
          const active = s === chrome.season
          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              disabled={pending}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-neon-blue/40 bg-neon-blue/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]',
                pending && 'opacity-60'
              )}
            >
              <span
                className={cn(
                  'font-display text-lg leading-none',
                  active ? 'text-neon-blue' : 'text-foreground/80'
                )}
              >
                {s.split('-')[0]}
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase">
                {s}
              </span>
              {active && <Check className="text-neon-blue h-4 w-4 shrink-0" />}
              {pending && !active && (
                <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-auto shrink-0 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center gap-3">
          <LeagueAvatar leagueId={chrome.leagueId} size="sm" name={chrome.leagueName} />
          <div className="min-w-0 flex-1">
            <p className="text-foreground/90 truncate text-sm leading-tight font-bold">
              {chrome.leagueName}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {chrome.memberCount} members
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Door icon={SettingsIcon} label="Settings" page="settings" />
          <Door icon={Users} label="Members" page="members" />
          <Door icon={Link2} label="Invite" page="invite" />
          <Door icon={History} label="History" page="history" />
        </div>
      </div>
    </div>
  )
}

function Door({
  icon: Icon,
  label,
  page,
}: {
  icon: typeof Users
  label: string
  page: LeaguePage
}) {
  return (
    <button
      type="button"
      onClick={() => openLeagueSheet(page)}
      className="text-muted-foreground hover:border-neon-blue/30 hover:text-neon-blue flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-1 py-2.5 transition-colors"
    >
      <Icon className="h-4 w-4" />
      <span className="text-[9px] font-bold tracking-[0.15em] uppercase">{label}</span>
    </button>
  )
}
