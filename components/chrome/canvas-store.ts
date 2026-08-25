/**
 * One tiny store for the canvas reveals (ported from RoarTracker's shell).
 *
 * The page card pulls back toward whichever top corner is AWAY from the
 * bubble you pressed: the rail's three panels — weeks, the lay, the
 * board — print under its left edge, and the two that are about you —
 * your leg, your profile — under its right. One channel, so opening any
 * of them closes the last.
 *
 * There is no POLLS panel. Every poll this app can make is a preseason
 * charter poll (app/actions/charter.ts is the only createPoll caller),
 * and the preseason page already lays them all out under ON THE BALLOT —
 * bigger, grouped, and showing what each one is FOR. A rung duplicating
 * that list could only ever be the same questions said worse, and it
 * drifted out of agreement with the ballot the moment a charter entry
 * was settled without its poll being closed.
 *
 * The league sheet is the exception: its trigger is the masthead, which
 * belongs to no edge, so it stays a portaled sheet on its own channel.
 */
export type CanvasPanel =
  | 'season'
  | 'slate'
  | 'parlay'
  | 'board'
  | 'submit'
  | 'compose'
  | 'ask'
  | 'profile'
  | 'venue'
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

/* ---------- What the stage is showing ---------- */

/* A finished season is a different object from one in progress: nothing
 * can change, no deadline matters, and "week 14 of 18" has stopped being
 * the useful frame. So the stage has two modes — the week you picked, or
 * the season read back as a whole.
 *
 * NULL is the important value: it means "nobody has chosen", and the
 * stage then decides from the season itself — a season that's over opens
 * on the recap, one still being played opens on its week. Storing a
 * default instead would mean reloading on a finished season dumped you
 * back on week 18, which is exactly what "go to a past year and see the
 * recap" is asking not to happen. Picking a week sets it explicitly. */
export type StageView = 'week' | 'recap'

let stageView: StageView | null = null
const stageViewListeners = new Set<(v: StageView | null) => void>()

export function setStageView(v: StageView | null) {
  if (stageView === v) return
  stageView = v
  stageViewListeners.forEach((l) => l(stageView))
}

export function subscribeStageView(
  listener: (v: StageView | null) => void
): () => void {
  stageViewListeners.add(listener)
  listener(stageView)
  return () => stageViewListeners.delete(listener)
}

/* ---------- The viewed week ---------- */

/* WHICH WEEK THE CARD IS SHOWING. The app is one page: picking a week
 * doesn't navigate, it changes this. The stage fetches whatever it needs
 * and swaps its content; the chrome re-reads its facts from the same id.
 * Null until the first render settles on the season's current week. */
let viewedWeekId: string | null = null
const viewedWeekListeners = new Set<(id: string | null) => void>()

export function setViewedWeek(id: string | null) {
  // Choosing a week IS leaving the recap. Making that a second, separate
  // gesture would mean picking week 4 and watching the season summary
  // stay on screen.
  if (id !== null) setStageView('week')
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

/* ---------- Opening one charter topic ---------- */

/* The RULES panel is a READER: it prints the league's settled business on
 * the canvas, topic by topic. Changing any of it is the preseason page's
 * job, and that page owns a sheet that already does it properly — with
 * the live poll, the approvals, the rename and the delete.
 *
 * Rather than grow a second, worse editor inside a 19rem column, the
 * panel hands the request across: "open Stakes, on Buy-in". The hub picks
 * it up if it's mounted, which it is exactly when the charter is
 * editable. Same seam as openSubmit — a request, not a state. */
export interface CharterGroupRequest {
  /** The topic's display name — built-in ("Stakes") or one the league made. */
  group: string
  /** Land straight on one item's page instead of the topic's list. */
  entryId?: string
  /** Versioned so asking twice for the same topic re-opens it. */
  version: number
}

let charterRequest: CharterGroupRequest | null = null
const charterListeners = new Set<(r: CharterGroupRequest) => void>()

export function openCharterGroup(group: string, entryId?: string) {
  charterRequest = {
    group,
    ...(entryId ? { entryId } : {}),
    version: (charterRequest?.version ?? 0) + 1,
  }
  charterListeners.forEach((l) => l(charterRequest!))
}

export function subscribeCharterGroup(
  listener: (r: CharterGroupRequest) => void
): () => void {
  charterListeners.add(listener)
  return () => charterListeners.delete(listener)
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
