/**
 * WHERE THE BUBBLES LIVE — the one place the edge-trigger geometry is
 * written down (ported from RoarTracker). Buttons (PanelBubbles,
 * AvatarNotch, ActionBubble) position themselves from these numbers, and
 * PageSheetCard feeds the same numbers through bite-geometry.ts to carve
 * the card, so a bubble and its bite can never drift apart.
 *
 * Bites are anchored, not absolute: `c` is the bite centre's distance from
 * its anchor edge (top or bottom of the card) — PageSheetCard resolves
 * them against the measured card height.
 *
 * The split-spring machinery from the source shell is kept intact but
 * DORMANT: this app currently has ONE action bite (SUBMIT / VOTE). If the
 * action ever grows a second verb, wire setSplit and the extra ranks are
 * already plumbed through resolveBites.
 */

import { BITE_FILLET, BITE_R, type Bite } from '@/components/chrome/bite-geometry'

export type AnchoredBite = {
  edge: 'left' | 'right'
  anchor: 'top' | 'bottom'
  c: number
  r: number
  fillet: number
}

/* The fixed bubbles. Left, top-anchored: the league's state trio. Right,
 * top-anchored: you — the LEAGUE sheet trigger (settings/members/profile
 * all live inside that one sheet). */
export const SLATE_C = 133.5
export const BOARD_C = 224.5
export const POLLS_C = 315.5
export const LEAGUE_C = 153
export const LEAGUE_R = 25

/* The action group, bottom-anchored on the right. HOME is the resting
 * SUBMIT (in-season) / VOTE (off-season) bubble; the upper ranks are the
 * dormant split slots (91px rhythm, matching the left trio). */
export const ACTION_HOME_C = 153
export const ACTION_RANK2_C = 244
export const ACTION_RANK3_C = 335

const STATIC_BITES: AnchoredBite[] = [
  { edge: 'left', anchor: 'top', c: SLATE_C, r: BITE_R, fillet: BITE_FILLET },
  { edge: 'left', anchor: 'top', c: BOARD_C, r: BITE_R, fillet: BITE_FILLET },
  { edge: 'left', anchor: 'top', c: POLLS_C, r: BITE_R, fillet: BITE_FILLET },
  { edge: 'right', anchor: 'top', c: LEAGUE_C, r: LEAGUE_R, fillet: 5 },
]

/* ---------- Season mode ---------- */

/* Off-/preseason has no week: the SLATE bite drops and its bubble with it
 * (there's nothing to slate). BOARD, POLLS and the avatar stay; the action
 * bubble pivots to VOTE. The clip follows: resolveBites drops the slate
 * bite, and the frame listeners re-carve on the switch. */
export type SeasonMode = 'in-season' | 'offseason'
let seasonMode: SeasonMode = 'in-season'

export function setSeasonMode(mode: SeasonMode) {
  if (seasonMode === mode) return
  seasonMode = mode
  if (mode === 'offseason') setSplit(false)
  frameListeners.forEach((l) => l(t, w))
}

export function getSeasonMode(): SeasonMode {
  return seasonMode
}

/* ---------- The split springs (dormant, kept intact) ---------- */

let target = 0 // 0 = folded, 1 = split
let t = 0 // animated split progress (can overshoot past 1)
let v = 0
let deep = false // a submenu is showing — the third rank stands down
let w = 0
let vw = 0
let raf: number | null = null
let last = 0

/** Per-frame listeners — geometry followers (the clip, the sliding disc). */
const frameListeners = new Set<(t: number, w: number) => void>()
/** State listeners — React (which buttons/icons/labels render). */
const stateListeners = new Set<(open: boolean) => void>()

function thirdTarget(): number {
  return target === 1 && !deep ? 1 : 0
}

function tick(now: number) {
  raf = null
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  // An underdamped spring: the arriving bubble overshoots its slot a hair
  // and settles — a split, not a slide.
  const STIFFNESS = 380
  const DAMPING = 30
  v += (target - t) * STIFFNESS * dt
  v -= v * DAMPING * dt
  t += v * dt
  const tw = thirdTarget()
  vw += (tw - w) * STIFFNESS * dt
  vw -= vw * DAMPING * dt
  w += vw * dt
  const settled =
    Math.abs(target - t) < 0.001 &&
    Math.abs(v) < 0.01 &&
    Math.abs(tw - w) < 0.001 &&
    Math.abs(vw) < 0.01
  if (settled) {
    t = target
    v = 0
    w = tw
    vw = 0
  } else {
    raf = requestAnimationFrame(tick)
  }
  frameListeners.forEach((l) => l(t, w))
}

function animate() {
  if (raf === null) {
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
}

export function setSplit(open: boolean) {
  const next = open ? 1 : 0
  if (next === target) return
  target = next
  if (!open) deep = false
  stateListeners.forEach((l) => l(open))
  settleOrAnimate()
}

export function setPodDeep(v2: boolean) {
  if (deep === v2) return
  deep = v2
  settleOrAnimate()
}

function settleOrAnimate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    t = target
    v = 0
    w = thirdTarget()
    vw = 0
    frameListeners.forEach((l) => l(t, w))
    return
  }
  animate()
}

export function isSplit(): boolean {
  return target === 1
}

export function subscribeSplitState(listener: (open: boolean) => void): () => void {
  stateListeners.add(listener)
  listener(target === 1)
  return () => stateListeners.delete(listener)
}

/**
 * Re-fire the current frame to everyone. A disc MOUNTS in response to a
 * frame, so on that first frame its ref is still null and its position
 * never lands — the bubbles re-emit after mounting.
 */
export function emitSplitFrame() {
  frameListeners.forEach((l) => l(t, w))
}

export function subscribeSplitFrame(listener: (t: number, w: number) => void): () => void {
  frameListeners.add(listener)
  listener(t, w)
  return () => frameListeners.delete(listener)
}

/** Rank 2's current centre distance from the card bottom. */
export function rank2C(progress: number): number {
  return ACTION_HOME_C + (ACTION_RANK2_C - ACTION_HOME_C) * progress
}

/** Rank 3's — on the third-rank spring. */
export function rank3C(progress: number): number {
  return ACTION_HOME_C + (ACTION_RANK3_C - ACTION_HOME_C) * progress
}

/**
 * Every bite, resolved against a card height — statics plus the action
 * group at its current spring position. The union tracer downstream makes
 * the overlapping frames of a split legal geometry, so this can be called
 * mid-flight every frame.
 */
export function resolveBites(cardHeight: number, progress: number, third = 0): Bite[] {
  const statics =
    seasonMode === 'offseason'
      ? STATIC_BITES.filter((b) => b.c !== SLATE_C || b.edge !== 'left')
      : STATIC_BITES
  const resolved: Bite[] = statics.map((b) => ({
    edge: b.edge,
    y: b.anchor === 'top' ? b.c : cardHeight - b.c,
    r: b.r,
    fillet: b.fillet,
  }))
  // The action bubble is the WEEK's verb (submit your leg). Off-season
  // there is no week, so the bite goes with it — POLLS is already one
  // tap away on the left edge and doesn't need a second door.
  if (seasonMode === 'offseason') return resolved
  resolved.push({
    edge: 'right',
    y: cardHeight - ACTION_HOME_C,
    r: BITE_R,
    fillet: BITE_FILLET,
  })
  if (progress > 0.001) {
    resolved.push({
      edge: 'right',
      y: cardHeight - rank2C(progress),
      r: BITE_R,
      fillet: BITE_FILLET,
    })
  }
  if (third > 0.001) {
    resolved.push({
      edge: 'right',
      y: cardHeight - rank3C(third),
      r: BITE_R,
      fillet: BITE_FILLET,
    })
  }
  return resolved
}
