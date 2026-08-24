/**
 * One tiny store for the canvas reveals (ported from RoarTracker's shell).
 *
 * The page card pulls back toward whichever top corner is AWAY from the
 * bubble you pressed: the rail's four panels — weeks, the lay, the board,
 * the polls — print under its left edge, and the two that are about you —
 * your leg, your profile — under its right. One channel, so opening any
 * of them closes the last.
 *
 * The league sheet is the exception: its trigger is the masthead, which
 * belongs to no edge, so it stays a portaled sheet on its own channel.
 */
export type CanvasPanel =
  | 'season'
  | 'slate'
  | 'parlay'
  | 'board'
  | 'polls'
  | 'submit'
  | 'profile'
  | null

type PanelListener = (panel: CanvasPanel) => void

let panel: CanvasPanel = null
const panelListeners = new Set<PanelListener>()

export function openPanel(p: Exclude<CanvasPanel, null>) {
  panel = panel === p ? null : p
  panelListeners.forEach((l) => l(panel))
}

export function closePanel() {
  panel = null
  panelListeners.forEach((l) => l(panel))
}

export function subscribePanel(listener: PanelListener): () => void {
  panelListeners.add(listener)
  listener(panel)
  return () => panelListeners.delete(listener)
}

/* ---------- The viewed week ---------- */

/* WHICH WEEK THE CARD IS SHOWING. The app is one page: picking a week
 * doesn't navigate, it changes this. The stage fetches whatever it needs
 * and swaps its content; the chrome re-reads its facts from the same id.
 * Null until the first render settles on the season's current week. */
let viewedWeekId: string | null = null
const viewedWeekListeners = new Set<(id: string | null) => void>()

export function setViewedWeek(id: string | null) {
  if (viewedWeekId === id) return
  viewedWeekId = id
  viewedWeekListeners.forEach((l) => l(viewedWeekId))
}

export function getViewedWeek(): string | null {
  return viewedWeekId
}

export function subscribeViewedWeek(
  listener: (id: string | null) => void
): () => void {
  viewedWeekListeners.add(listener)
  listener(viewedWeekId)
  return () => viewedWeekListeners.delete(listener)
}

/* ---------- The league sheet ---------- */

/* The two league surfaces that need real width — the full standings
 * table and the invite flow. Everything else about the league is on the
 * season panel, visible without opening anything. The board panel opens
 * the standings; the roster's "+" opens the invite. */
export type LeaguePage = 'standings' | 'invite'

let leaguePage: LeaguePage | null = null
const leagueListeners = new Set<(page: LeaguePage | null) => void>()

export function openLeagueSheet(page: LeaguePage = 'standings') {
  leaguePage = page
  leagueListeners.forEach((l) => l(leaguePage))
}

export function closeLeagueSheet() {
  leaguePage = null
  leagueListeners.forEach((l) => l(leaguePage))
}

export function subscribeLeagueSheet(
  listener: (page: LeaguePage | null) => void
): () => void {
  leagueListeners.add(listener)
  listener(leaguePage)
  return () => leagueListeners.delete(listener)
}

/* ---------- The submit reveal's arm counter ---------- */

/** Versioned so re-tapping SUBMIT while the reveal is open re-focuses the
 *  form instead of doing nothing. */
const submitListeners = new Set<(version: number) => void>()
let submitVersion = 0

export function openSubmit() {
  submitVersion++
  submitListeners.forEach((l) => l(submitVersion))
  if (panel !== 'submit') openPanel('submit')
}

export function subscribeSubmit(listener: (version: number) => void): () => void {
  submitListeners.add(listener)
  return () => submitListeners.delete(listener)
}
