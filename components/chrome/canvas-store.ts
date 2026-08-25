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

/* ---------- Switching seasons ---------- */

/* The season the app is MOVING TO, while it's moving.
 *
 * Picking a year writes the cookie and refreshes the tree, and a refresh
 * is a server round trip — so without this the whole shell sits on last
 * season's numbers, unchanged, until it lands. Announcing the switch here
 * the moment it's asked for splits the app in two for that second:
 * everything that only needs the YEAR (the masthead lockup, the season
 * list's tick) takes it immediately, and everything that needs the
 * season's DATA (the stage, the panels, the rail's faces) knows to show a
 * skeleton rather than keep insisting on facts that are about to be
 * wrong. Null when nothing is in flight. */
let switchingSeason: string | null = null
const switchingListeners = new Set<(season: string | null) => void>()

export function setSwitchingSeason(season: string | null) {
  if (switchingSeason === season) return
  switchingSeason = season
  switchingListeners.forEach((l) => l(switchingSeason))
}

export function subscribeSwitchingSeason(
  listener: (season: string | null) => void
): () => void {
  switchingListeners.add(listener)
  listener(switchingSeason)
  return () => switchingListeners.delete(listener)
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

/* ---------- What the viewed week lets you do ---------- */

/* The action pod lives in the shell, but everything it needs to know —
 * is the week closed, can it be reopened, is your leg already in — is
 * what the STAGE just fetched. Rather than have the shell re-query it,
 * the stage publishes it here as it swaps weeks. Same shape of seam as
 * the viewed week itself. */
export interface WeekActions {
  /** The week has a slate to bet at all. */
  hasSlate: boolean
  /** Somebody has closed it to new entries. */
  locked: boolean
  /** Closing it can still be undone — no game we bet has started. */
  reopenable: boolean
  /** The viewer may close or reopen it. */
  canLock: boolean
  /** The viewer's leg is already in. */
  submitted: boolean
}

const NO_ACTIONS: WeekActions = {
  hasSlate: false,
  locked: false,
  reopenable: false,
  canLock: false,
  submitted: false,
}

let weekActions: WeekActions = NO_ACTIONS
const weekActionListeners = new Set<(a: WeekActions) => void>()

export function setWeekActions(next: WeekActions) {
  const same =
    weekActions.hasSlate === next.hasSlate &&
    weekActions.locked === next.locked &&
    weekActions.reopenable === next.reopenable &&
    weekActions.canLock === next.canLock &&
    weekActions.submitted === next.submitted
  if (same) return
  weekActions = next
  weekActionListeners.forEach((l) => l(weekActions))
}

export function subscribeWeekActions(
  listener: (a: WeekActions) => void
): () => void {
  weekActionListeners.add(listener)
  listener(weekActions)
  return () => weekActionListeners.delete(listener)
}

/* A week changed under us. The pod closes a week from the shell, but the
 * week's content is cached in the stage — this is how the shell tells it
 * to go and look again. */
let weekDirty = 0
const weekDirtyListeners = new Set<(n: number) => void>()

export function markWeekDirty() {
  weekDirty++
  weekDirtyListeners.forEach((l) => l(weekDirty))
}

export function subscribeWeekDirty(listener: (n: number) => void): () => void {
  weekDirtyListeners.add(listener)
  return () => weekDirtyListeners.delete(listener)
}

/* ---------- The league sheet ---------- */

/* The one league surface still worth a portaled sheet: the invite flow.
 * The standings left for the BOARD panel, which now pages in to any one
 * person's season; everything else is on the season panel, visible
 * without opening anything. */
export type LeaguePage = 'invite'

let leaguePage: LeaguePage | null = null
const leagueListeners = new Set<(page: LeaguePage | null) => void>()

export function openLeagueSheet(page: LeaguePage = 'invite') {
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
