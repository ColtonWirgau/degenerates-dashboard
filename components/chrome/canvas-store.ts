/**
 * One tiny store for the canvas reveals (ported from RoarTracker's shell).
 *
 * The page card can pull back toward either top corner: the SUBMIT reveal
 * lives under its right edge, and the left rail's three panels — slate,
 * board, polls — share the space under its left. The LEAGUE surface (the
 * combined account + league sheet) is a portaled sheet, not a canvas
 * reveal, so it rides its own channel.
 */
export type CanvasPanel = 'slate' | 'board' | 'polls' | 'submit' | null

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

/* ---------- The league sheet ---------- */

/* The LEAGUE — settings, members, invites, profile, seasons — is the
 * existing multi-page LeagueSheet (a portaled ResponsiveSheet), not a
 * canvas reveal. Every trigger (avatar notch, masthead avatar, dock
 * LEAGUE cell) opens this one channel. */
let leagueOpen = false
const leagueListeners = new Set<(open: boolean) => void>()

export function openLeagueSheet() {
  leagueOpen = true
  closePanel()
  leagueListeners.forEach((l) => l(leagueOpen))
}

export function closeLeagueSheet() {
  leagueOpen = false
  leagueListeners.forEach((l) => l(leagueOpen))
}

export function subscribeLeagueSheet(listener: (open: boolean) => void): () => void {
  leagueListeners.add(listener)
  listener(leagueOpen)
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
