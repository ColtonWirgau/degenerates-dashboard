'use client'

import { useEffect, useState } from 'react'
import {
  closeLeagueSheet,
  subscribeLeagueSheet,
  type LeaguePage,
} from '@/components/chrome/canvas-store'
import { ResponsiveSheet, SheetPage } from '@/components/ui/responsive-sheet'
import { InvitePage } from '@/components/league-pages'
import { MockPage } from '@/components/user-menu'
import type { DevToolbarData } from '@/lib/data/dev-toolbar-data'

export interface LeagueSheetProps {
  leagueId: string
  inviteCode: string
  canManage: boolean
  /** Mock-mode dev controls. Null in production / neon. */
  mock?: DevToolbarData | null
}

/**
 * THE INVITE FLOW — the last thing here that isn't somewhere better.
 *
 * This used to also hold the standings table and a per-member drill-in,
 * on the theory that a week-by-week grid needs width. One person's season
 * turned out to be a list rather than a grid, so it pages in on the BOARD
 * panel instead and the table went with it. Everything else about the
 * league lives on the season panel, visible without opening anything.
 */
export function LeagueSheet(props: LeagueSheetProps) {
  const [page, setPage] = useState<LeaguePage | null>(null)
  useEffect(() => subscribeLeagueSheet(setPage), [])
  const open = page !== null

  return (
    <ResponsiveSheet
      open={open}
      onClose={closeLeagueSheet}
      defaultPage="invite"
      panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
      maxWidth="max-w-3xl"
      sheetMaxHeight="92dvh"
    >
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

    </ResponsiveSheet>
  )
}
