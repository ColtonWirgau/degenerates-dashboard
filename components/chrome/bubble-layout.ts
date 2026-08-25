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
 * The split springs drive the ACTION POD: the resting slot holds ACTIONS,
 * and the week's two verbs spring up out of it into ranks 2 and 3. The
 * card's bites follow the same numbers frame by frame, so the holes and
 * the discs can't disagree mid-flight.
 */

import { BITE_FILLET, BITE_R, type Bite } from '@/components/chrome/bite-geometry'

/* ---------- The left rail ---------- */

/* The rail is a LADDER, not a set of named positions: bubbles fill it from
 * the top down in a fixed order (week → parlay → board → polls), and the
 * ones this week doesn't have simply aren't there. That keeps the rail
 * contiguous on every week — no holes where a missing noun used to be —
 * while the order never changes, so your hand learns it once.
 *
 * The right edge, top-anchored, is you: the profile sheet's trigger. */
/* The first rung starts BELOW the card's top-left corner, because that
 * corner is now a control in its own right: the week's number slab, which
 * opens the week list. A bite at 133.5 put a hole through the bottom of
 * that slab; the rail begins under it instead. */
export const RAIL_TOP = 205
export const RAIL_STEP = 91
export const PROFILE_C = 153
export const PROFILE_R = 25

/** Where the nth left bubble's bite sits, measured from the card top. */
export function railC(index: number): number {
  return RAIL_TOP + RAIL_STEP * index
}

/* The action group, bottom-anchored on the right. HOME is the resting
 * ACTIONS bubble; the ranks above it are where its verbs land (91px
 * rhythm, matching the rail).
 *
 * THREE of them now. Two was the week's own pair — your leg, and closing
 * the week — and it was full the moment a week wanted to hold a question
 * as well. Each rank rides its own spring so they arrive staggered
 * rather than as a block; the card's bites follow the same numbers, so a
 * disc and its hole can't disagree mid-flight. */
export const ACTION_HOME_C = 153
export const ACTION_RANK2_C = 244
export const ACTION_RANK3_C = 335
export const ACTION_RANK4_C = 426

/* ---------- What the week offers ---------- */

/* The chrome is a function of the week you're looking at, and the card's
 * silhouette follows exactly: a week with no polls carves no POLLS bite,
 * and the preseason week — no games, so nothing to bet — carves no action
 * bite. A bubble and its hole can never disagree, because both read these.
 *
 * Set by the bubbles as the viewed week changes; the frame listeners
 * re-carve on the switch. */
let railCount = 2
let actionBite = true

/** How many bubbles the rail is currently showing. */
export function setRailCount(n: number) {
  if (railCount === n) return
  railCount = n
  frameListeners.forEach((l) => l(t, w, u))
}

export function setActionBite(on: boolean) {
  if (actionBite === on) return
  actionBite = on
  if (!on) setSplit(false)
  frameListeners.forEach((l) => l(t, w, u))
}

/* ---------- The split springs ---------- */

let target = 0 // 0 = folded, 1 = split
let t = 0 // animated split progress (can overshoot past 1)
let v = 0
let deep = false // a submenu is showing — the upper ranks stand down
let w = 0
let vw = 0
let u = 0
let vu = 0
let raf: number | null = null
let last = 0

/** Per-frame listeners — geometry followers (the clip, the sliding disc). */
const frameListeners = new Set<(t: number, w: number, u: number) => void>()
/** State listeners — React (which buttons/icons/labels render). */
const stateListeners = new Set<(open: boolean) => void>()

/** Ranks 3 and 4 fold away together when a submenu takes the pod. */
function upperTarget(): number {
  return target === 1 && !deep ? 1 : 0
}

function tick(now: number) {
  // NOTE: `raf` is deliberately NOT cleared here. Clearing it up front
  // opens a window where a listener firing below can see raf === null,
  // call animate(), and schedule a second loop — and the handle we
  // overwrite on the way out leaks the first one. Two loops become four.
  // It stays set until the spring actually settles.
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  // An underdamped spring: the arriving bubble overshoots its slot a hair
  // and settles — a split, not a slide.
  const STIFFNESS = 380
  const DAMPING = 30
  v += (target - t) * STIFFNESS * dt
  v -= v * DAMPING * dt
  t += v * dt
  const tw = upperTarget()
  vw += (tw - w) * STIFFNESS * dt
  vw -= vw * DAMPING * dt
  w += vw * dt
  // Rank 4 is softer, so it trails the one below it out of the slot
  // instead of arriving alongside — three discs landing on the same
  // frame reads as a menu appearing, not as a pod splitting.
  vu += (tw - u) * (STIFFNESS * 0.72) * dt
  vu -= vu * DAMPING * dt
  u += vu * dt
  const settled =
    Math.abs(target - t) < 0.001 &&
    Math.abs(v) < 0.01 &&
    Math.abs(tw - w) < 0.001 &&
    Math.abs(vw) < 0.01 &&
    Math.abs(tw - u) < 0.001 &&
    Math.abs(vu) < 0.01
  if (settled) {
    t = target
    v = 0
    w = tw
    vw = 0
    u = tw
    vu = 0
    raf = null
  } else {
    raf = requestAnimationFrame(tick)
  }
  frameListeners.forEach((l) => l(t, w, u))
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
    w = upperTarget()
    vw = 0
    u = w
    vu = 0
    frameListeners.forEach((l) => l(t, w, u))
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
  frameListeners.forEach((l) => l(t, w, u))
}

export function subscribeSplitFrame(
  listener: (t: number, w: number, u: number) => void
): () => void {
  frameListeners.add(listener)
  listener(t, w, u)
  return () => frameListeners.delete(listener)
}

/** Rank 2's current centre distance from the card bottom. */
export function rank2C(progress: number): number {
  return ACTION_HOME_C + (ACTION_RANK2_C - ACTION_HOME_C) * progress
}

/** Rank 3's — on its own spring. */
export function rank3C(progress: number): number {
  return ACTION_HOME_C + (ACTION_RANK3_C - ACTION_HOME_C) * progress
}

/** Rank 4's — on the softest spring, so it lands last. */
export function rank4C(progress: number): number {
  return ACTION_HOME_C + (ACTION_RANK4_C - ACTION_HOME_C) * progress
}

/**
 * Every bite, resolved against a card height — the rail, your notch, and
 * the action group at its current spring position. The union tracer
 * downstream makes the overlapping frames of a split legal geometry, so
 * this can be called mid-flight every frame.
 */
export function resolveBites(
  cardHeight: number,
  progress: number,
  third = 0,
  fourth = 0
): Bite[] {
  const resolved: Bite[] = []
  // The rail, filled top-down: however many bubbles this week has.
  for (let i = 0; i < railCount; i++) {
    resolved.push({ edge: 'left', y: railC(i), r: BITE_R, fillet: BITE_FILLET })
  }
  // You, on the right.
  resolved.push({ edge: 'right', y: PROFILE_C, r: PROFILE_R, fillet: 5 })
  // The action pod is the WEEK's verbs. The preseason week has no slate,
  // so the bites go with it.
  if (!actionBite) return resolved
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
  if (fourth > 0.001) {
    resolved.push({
      edge: 'right',
      y: cardHeight - rank4C(fourth),
      r: BITE_R,
      fillet: BITE_FILLET,
    })
  }
  return resolved
}
