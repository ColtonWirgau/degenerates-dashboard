/**
 * The card outline, GENERATED — one source of truth for the bubble bites.
 *
 * The page sheet used to carve its bites with a hand-built CSS mask stack
 * (radial gradients + pre-shaped SVG slivers), which meant every bubble's
 * geometry lived twice: once as button offsets, once as mask layers — and
 * the mask's calc(100% − x) position semantics bit us more than once. Now
 * the bites are data (see bubble-layout.ts) and this module traces the
 * whole card perimeter as ONE clip-path path(): rounded corners, then a
 * detour into each bite — the bite's arc plus the two concave tangent
 * fillets that flare it into the edge. PageSheetCard regenerates the path
 * on resize and on every animation frame of a moving bubble, so the cutout
 * FOLLOWS the bubbles: slide a bite and the hole slides; overlap two and
 * the tracer emits their union silhouette (that's what a bubble "split"
 * animates through).
 *
 * All pure math, no DOM — feed it a size and a bite list, get a path
 * string.
 */

export type Edge = "left" | "right";

/** A bite resolved to card space: centre `y` px from the card's top, on
 *  one vertical edge. The circle's centre sits ON the edge line. */
export type Bite = {
  edge: Edge;
  y: number;
  r: number;
  /** Radius of the concave junction fillets where the circle meets the
   *  edge. Scaled down automatically when r shrinks (a popping bubble). */
  fillet: number;
};

/* Shared bubble construction constants — the button boxes are built around
 * the same numbers the bites are. */
export const BITE_R = 31.5;
export const BITE_FILLET = 6;
/** The trigger button box: 64×75 with the 44px disc at (10, 15.5) — so the
 *  disc centre (= bite centre) sits 37.5px from the box's anchored edge. */
export const DISC_CENTER = 37.5;

type Pt = { x: number; y: number };
type Seg =
  | { cmd: "L"; to: Pt }
  | { cmd: "A"; r: number; large: 0 | 1; sweep: 0 | 1; to: Pt };

const TAU = Math.PI * 2;

const fmt = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

const angle = (p: Pt, c: Pt) => Math.atan2(p.y - c.y, p.x - c.x);

/** Counterclockwise-on-screen angular span from a1 to a2 (SVG's y grows
 *  down, so screen-CCW is DECREASING SVG angle). */
const ccwSpan = (a1: number, a2: number) => (((a1 - a2) % TAU) + TAU) % TAU;

/**
 * Segments for the RIGHT edge traversed top→bottom at x = w. Overlapping
 * bites are clustered and traced as a union: fillets only at the cluster's
 * outer junctions, circle-to-circle handoff at their interior intersection
 * point. Left-edge segments are these, rotated 180° (see cardOutline) —
 * rotation preserves arc sweep, so the flags carry over untouched.
 */
function rightEdgeSegments(w: number, bites: Bite[]): Seg[] {
  const sorted = [...bites]
    .filter((b) => b.r > 0.75)
    .sort((a, b) => a.y - b.y)
    // A bite fully inside a neighbour contributes nothing to the union.
    // (Index tie-break: two IDENTICAL circles — a split's first frame —
    // contain each other, and must drop exactly one, not both.)
    .filter((b, i, arr) =>
      arr.every(
        (o, j) =>
          j === i ||
          !(Math.abs(o.y - b.y) + b.r <= o.r + 0.01) ||
          (o.r === b.r && o.y === b.y && j > i),
      ),
    );

  // Cluster circles whose silhouettes touch.
  const clusters: Bite[][] = [];
  for (const b of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && b.y - last[last.length - 1].y < last[last.length - 1].r + b.r) {
      last.push(b);
    } else {
      clusters.push([b]);
    }
  }

  const segs: Seg[] = [];
  for (const cluster of clusters) {
    const first = cluster[0];
    const last = cluster[cluster.length - 1];
    // Fillets scale away with a shrinking bite so a pop stays smooth.
    const fIn = Math.min(first.fillet, first.r * 0.4);
    const fOut = Math.min(last.fillet, last.r * 0.4);
    // The fillet circle sits `f` inside the edge, tangent to both the edge
    // line and the bite circle — k is its centre's edge-distance from the
    // bite's centre.
    const kIn = Math.sqrt((first.r + fIn) ** 2 - fIn ** 2);
    const kOut = Math.sqrt((last.r + fOut) ** 2 - fOut ** 2);

    // Down the edge to the top fillet's edge-tangent, then the fillet arc
    // into the first circle.
    segs.push({ cmd: "L", to: { x: w, y: first.y - kIn } });
    const tIn: Pt = {
      x: w - (first.r * fIn) / (first.r + fIn),
      y: first.y - (first.r * kIn) / (first.r + fIn),
    };
    segs.push({ cmd: "A", r: fIn, large: 0, sweep: 1, to: tIn });

    // Around each circle in the cluster, west-about (into the card),
    // handing off to the next at their interior intersection.
    let from = tIn;
    for (let i = 0; i < cluster.length; i++) {
      const b = cluster[i];
      const centre: Pt = { x: w, y: b.y };
      let to: Pt;
      if (i < cluster.length - 1) {
        const nb = cluster[i + 1];
        const d = nb.y - b.y;
        const a = (d * d + b.r * b.r - nb.r * nb.r) / (2 * d);
        to = { x: w - Math.sqrt(Math.max(0, b.r * b.r - a * a)), y: b.y + a };
      } else {
        to = {
          x: w - (b.r * fOut) / (b.r + fOut),
          y: b.y + (b.r * kOut) / (b.r + fOut),
        };
      }
      const span = ccwSpan(angle(from, centre), angle(to, centre));
      segs.push({ cmd: "A", r: b.r, large: span > Math.PI ? 1 : 0, sweep: 0, to });
      from = to;
    }

    // The bottom fillet back out to the edge.
    segs.push({ cmd: "A", r: fOut, large: 0, sweep: 1, to: { x: w, y: last.y + kOut } });
  }
  return segs;
}

/**
 * The full card outline as a path() string: a `radius`-rounded rect of
 * `w`×`h`, bitten. Traced clockwise from the top edge.
 */
export function cardOutline(w: number, h: number, radius: number, bites: Bite[]): string {
  const right = bites.filter((b) => b.edge === "right");
  // The left edge is the right edge rotated 180° about the card's centre:
  // trace mirrored bites down a virtual right edge, then map every point
  // (x, y) → (w − x, h − y). Rotation preserves orientation, so arc flags
  // are reused as-is, and the reversed order comes out bottom→top — exactly
  // the left edge's travel direction on a clockwise perimeter.
  const left = rightEdgeSegments(
    w,
    bites.filter((b) => b.edge === "left").map((b) => ({ ...b, y: h - b.y })),
  ).map((s) => ({ ...s, to: { x: w - s.to.x, y: h - s.to.y } }));

  const d: string[] = [];
  const arc = (r: number, large: 0 | 1, sweep: 0 | 1, to: Pt) =>
    d.push(`A ${fmt(r)} ${fmt(r)} 0 ${large} ${sweep} ${fmt(to.x)} ${fmt(to.y)}`);
  const seg = (s: Seg) =>
    s.cmd === "L"
      ? d.push(`L ${fmt(s.to.x)} ${fmt(s.to.y)}`)
      : arc(s.r, s.large, s.sweep, s.to);

  d.push(`M ${fmt(radius)} 0`);
  d.push(`L ${fmt(w - radius)} 0`);
  arc(radius, 0, 1, { x: w, y: radius });
  rightEdgeSegments(w, right).forEach(seg);
  d.push(`L ${fmt(w)} ${fmt(h - radius)}`);
  arc(radius, 0, 1, { x: w - radius, y: h });
  d.push(`L ${fmt(radius)} ${fmt(h)}`);
  arc(radius, 0, 1, { x: 0, y: h - radius });
  left.forEach(seg);
  d.push(`L 0 ${fmt(radius)}`);
  arc(radius, 0, 1, { x: radius, y: 0 });
  d.push("Z");
  return d.join(" ");
}
