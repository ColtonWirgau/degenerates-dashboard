// Mock league Charter — structured facts the league ratifies each
// preseason. Schema-wise this is distinct from Polls (votes) and
// Suggestions (idea inbox). A Charter entry has:
//   - A current value (or null when not yet set)
//   - An approval rule that controls how changes are ratified
//   - A status: draft (not yet decided) / pending (proposal awaiting
//     approvals) / locked (ratified for the season)
//   - Optional link to a poll the entry's value is derived from
//
// Per the design call: per-entry approval rules (more flexible, smart
// defaults) and a "start blank" each season (no carry-forward by default).

import type { User } from './types';

export type CharterApprovalRule =
  | 'commish' // commissioner overrides — single decision-maker
  | 'majority' // > 50% of members approve
  | 'supermajority' // configurable threshold (default 0.75)
  | 'unanimous' // all members must approve
  | 'poll'; // value derived from a linked poll's outcome

export type CharterStatus = 'draft' | 'pending' | 'locked';

export type CharterCategory =
  | 'logistics'
  | 'rules'
  | 'punishment'
  | 'format'
  | 'custom'
  | 'stakes'
  | 'keepers'
  | 'trading'
  | 'playoffs';

/** Metadata for the special-render entries (e.g. eligible-keepers
 *  publishes a per-team roster that the EntryDock's expanded view
 *  renders as a table). Loosely typed for forward extension. */
export interface KeeperRosterRow {
  userId: string;
  player: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  /** Cost to keep — round number (or ADP-round in year 2). */
  round: number;
  /** 1 = first year keeping this player, 2 = second year (ADP cost). */
  yearOfKeep: 1 | 2;
}

export interface CharterApproval {
  userId: string;
  approved: boolean;
  approvedAt: string;
}

export interface CharterPending {
  value: string;
  proposedBy: string;
  proposedAt: string;
  approvals: CharterApproval[];
}

export interface CharterEntry {
  id: string;
  /** Stable machine key — 'draft-date', 'commissioner', etc. Custom
   *  entries get auto-generated keys. */
  key: string;
  label: string;
  category: CharterCategory;
  /** The ratified value. Null until status === 'locked'. */
  value: string | null;
  /** Long-form explanation of what this entry means / the mechanics
   *  behind it. Shown in the expanded sheet row (and on the proposal
   *  form when this entry is being voted on) — never on the card,
   *  where space is tight and `value` carries the headline. */
  description?: string | null;
  season: string;
  source: 'manual' | 'derived-from-poll';
  /** When `source === 'derived-from-poll'`, the entry's value mirrors
   *  whichever option that poll's voters pick. The entry stays in
   *  `draft` until the poll closes, then snaps to `locked` with the
   *  winning option as `value`. */
  pollId: string | null;
  approvalRule: CharterApprovalRule;
  /** Required for `supermajority` (0–1 fraction). Null for other rules. */
  threshold: number | null;
  status: CharterStatus;
  proposedBy: string | null;
  proposedAt: string | null;
  lockedAt: string | null;
  pending: CharterPending | null;
  /** Custom payload for entries with special rendering. E.g. the
   *  `eligible-keepers` entry attaches the keeper roster here so the
   *  EntryDock's expanded action panel can render it as a table. User-added
   *  custom entries carry their display group name in `group`. */
  metadata?: {
    keeperRoster?: KeeperRosterRow[];
    group?: string;
    venue?: VenueDetails;
    /** On `draft-date`: the machine-readable halves behind the display
     *  string, so the editor can round-trip what somebody picked
     *  instead of re-parsing prose it wrote itself. */
    when?: { date?: string; time?: string };
  };
}

/**
 * Where the draft actually happens, as opposed to what the league
 * DECIDED about where it happens.
 *
 * The entry's `value` is the decision — "Don Christos" — and that's what
 * gets proposed, voted on and locked. An address and a phone number
 * aren't decisions; they're facts about the place, and nobody votes on
 * a postcode. So they ride along in metadata on the same row rather
 * than earning a table: one thing to look up, one thing to revalidate,
 * and the ratification machinery keeps working on the part that's
 * actually ratified.
 */
export interface VenueDetails {
  address?: string;
  phone?: string;
  /** Anything the address doesn't say — "back room, ask for Sal". */
  note?: string;
  /** Filled by a geocode when the address is saved; absent if the
   *  lookup failed or was never run. The map is the only thing that
   *  needs them — every maps link works off the address text. */
  lat?: number;
  lng?: number;
  /** The footage behind the hero's venue half. Absent means the
   *  bundled clip — a league that hasn't picked one still gets a room
   *  rather than a black rectangle. */
  videoUrl?: string;
  posterUrl?: string;
}

interface CharterTemplate {
  key: string;
  label: string;
  category: CharterCategory;
  /** Optional long-form explanation. Drops onto the resulting
   *  CharterEntry's `description` field. */
  description?: string;
  approvalRule: CharterApprovalRule;
  threshold?: number;
  /** When set, the entry's value is derived from this poll's outcome.
   *  The mock generator looks up the poll's winning option to fill
   *  `value` if the poll has been closed. */
  pollId?: string;
  /** Manual locked value — used when source is 'manual' and status is
   *  'locked'. */
  manualValue?: string;
  /** Optional pending proposal (admin/member proposed a value, awaiting
   *  approvals). When set, status is forced to 'pending'. */
  pending?: {
    value: string;
    proposedBy: 'first' | 'self';
    proposedDaysAgo: number;
    /** Number of members (other than viewer) who've approved. */
    approvalsFromOthers: number;
    /** Whether the viewer has approved. */
    viewerApproved?: boolean;
  };
  /** Days ago this entry was locked. Required when source is manual and
   *  status should be 'locked'. */
  lockedDaysAgo?: number;
  /** When true, the generator attaches the eligible-keepers roster as
   *  `metadata.keeperRoster` for special table rendering. */
  attachKeeperRoster?: boolean;
}

// Charter templates modelled after a real fantasy-football league
// charter — buy-in/payouts, keeper rules, trading policy, playoff
// format, etc. Mix of manual+locked (settled rules carried season-
// to-season), poll-derived (still being decided this preseason), and
// one manual+pending (the trade-veto-threshold demo for approvals).
const CHARTER_TEMPLATES: CharterTemplate[] = [
  // ─── Draft ────────────────────────────────────────────────────────────
  {
    key: 'draft-date',
    label: 'Date',
    category: 'logistics',
    approvalRule: 'poll',
    pollId: 'draft-date', // open — chart shows live tally
    description:
      'When we hold the draft. Pick every date that works for you — the most-available date wins.',
  },
  {
    key: 'draft-format',
    label: 'Format',
    category: 'format',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: 'Snake + 3rd Rd Reversal',
    description:
      'Standard snake order with a reversal in round 3: the last pick of round 2 picks first in round 3, then the snake continues. Helps balance the swing of an early pick over multiple rounds.',
    lockedDaysAgo: 60,
  },
  {
    key: 'draft-location',
    label: 'Location',
    category: 'logistics',
    approvalRule: 'majority',
    description:
      'Where we physically draft. Same place we hold the kickoff watch party most years — TVs, food, plenty of space for laptops.',
  },

  // ─── Stakes ───────────────────────────────────────────────────────────
  {
    key: 'buy-in',
    label: 'Buy-in',
    category: 'stakes',
    approvalRule: 'majority',
    manualValue: '$50 · 12 teams · $600 pot',
    description: 'Standard yearly buy-in. All dues collected before draft day.',
    lockedDaysAgo: 30,
  },
  {
    key: 'payouts',
    label: 'Payouts',
    category: 'stakes',
    approvalRule: 'majority',
    manualValue: '1st: $300 · 2nd: $130',
    description:
      'Top 2 finishers split the season pot. Remainder funds the weekly pot + trophy.',
    lockedDaysAgo: 30,
  },
  {
    key: 'weekly-pot',
    label: 'Weekly Pot',
    category: 'stakes',
    approvalRule: 'majority',
    manualValue: 'Top 2 · $5/wk · 17 wks',
    description:
      'Top two highest scorers each week split a $5 side pot. Runs all 17 regular-season weeks.',
    lockedDaysAgo: 30,
  },
  {
    key: 'dues-tracking',
    label: 'Dues Tracking',
    category: 'stakes',
    approvalRule: 'commish',
    manualValue: 'Sleeper app',
    description: 'Commish tracks who has paid + outstanding dues inside the Sleeper app.',
    lockedDaysAgo: 30,
  },

  // ─── Keepers ──────────────────────────────────────────────────────────
  {
    key: 'keeper-slots',
    label: 'Slots',
    category: 'keepers',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: '1 per team / yr',
    description:
      'Each team can keep one player per season. Slot resets if you choose not to declare a keeper.',
    lockedDaysAgo: 60,
  },
  {
    key: 'keeper-cost',
    label: 'Keeper Cost',
    category: 'keepers',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: 'Round drafted · Yr 2: ADP',
    description:
      'Year 1: keeper costs the round they were drafted in (undrafted → last round). Year 2: cost flips to current ADP at draft time, so star keepers naturally get more expensive.',
    lockedDaysAgo: 60,
  },
  {
    key: 'keeper-restrictions',
    label: 'Restrictions',
    category: 'keepers',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: 'Max 2 yrs · No R1–4',
    description:
      'A player can only be kept for two seasons total. Picks from rounds 1–4 are never eligible (prevents stacking elite talent indefinitely).',
    lockedDaysAgo: 60,
  },
  {
    key: 'keeper-traded-pick',
    label: 'Traded Pick Rule',
    category: 'keepers',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: 'Bumps up a round',
    description:
      'If you traded away the round your keeper was drafted in, the keeper moves up one round. Keeps trades meaningful without disqualifying future keepers.',
    lockedDaysAgo: 60,
  },
  {
    key: 'keeper-deadline',
    label: 'Declaration Deadline',
    category: 'keepers',
    approvalRule: 'commish',
    manualValue: '24h before draft',
    description:
      'Hard deadline: keepers must be declared in writing 24 hours before draft start. A week prior is encouraged so everyone can plan.',
    lockedDaysAgo: 30,
  },
  {
    key: 'eligible-keepers',
    label: 'Eligible Keepers',
    category: 'keepers',
    approvalRule: 'commish',
    manualValue: '12 rosters · tap to view',
    description:
      'Per-team roster of keeper-eligible players. Commish compiles this from the prior season + applies the restriction rules. Tap an entry to see the full grid.',
    lockedDaysAgo: 5,
    attachKeeperRoster: true,
  },

  // ─── Trading ──────────────────────────────────────────────────────────
  {
    key: 'trade-veto-policy',
    label: 'Veto Policy',
    category: 'trading',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: 'Commish call only',
    description:
      'Trades stand unless there is clear evidence of collusion. No member vote on vetoes — commish makes the call (or a commish team if commish is involved).',
    lockedDaysAgo: 60,
  },
  {
    key: 'collusion-process',
    label: 'Collusion Process',
    category: 'trading',
    approvalRule: 'commish',
    manualValue: 'Flag to commish team',
    description:
      'Suspect a trade? Flag it to the commish (or commish team if conflicted). They review, talk to both parties, and decide. Decision is final.',
    lockedDaysAgo: 60,
  },
  {
    // Pending-proposal demo lives here now (was a generic Rules row).
    key: 'trade-deadline',
    label: 'Trade Deadline',
    category: 'trading',
    approvalRule: 'supermajority',
    threshold: 0.75,
    description:
      'No trades after the deadline so the playoff race stays clean. Sleeper default is end of Week 11; we are proposing to keep that.',
    pending: {
      value: 'End of Week 11',
      proposedBy: 'first',
      proposedDaysAgo: 4,
      approvalsFromOthers: 6,
      viewerApproved: false,
    },
  },

  // ─── Playoffs ─────────────────────────────────────────────────────────
  {
    key: 'playoff-format',
    label: 'Bracket',
    category: 'playoffs',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: '8 teams · 3 rounds',
    description:
      'Eight teams qualify, three rounds of head-to-head matchups, single-elimination. Top 2 seeds get a bye week 15.',
    lockedDaysAgo: 60,
  },
  {
    key: 'regular-season-length',
    label: 'Regular Season',
    category: 'playoffs',
    approvalRule: 'supermajority',
    threshold: 0.75,
    manualValue: '14 weeks',
    description:
      'Regular season runs 14 weeks instead of the default 13 — one extra week of seeding before playoff weeks 15–17.',
    lockedDaysAgo: 60,
  },
  {
    key: 'last-place-penalty',
    label: 'Last Place',
    category: 'playoffs',
    approvalRule: 'majority',
    manualValue: 'See The Pick',
    description:
      "Last-place finisher takes the punishment ratified in Punishment → The Pick. Voted on separately so the punishment doesn't dictate playoff format.",
    lockedDaysAgo: 30,
  },

  // ─── Punishment ───────────────────────────────────────────────────────
  {
    key: 'punishment',
    label: 'The Pick',
    category: 'punishment',
    approvalRule: 'poll',
    pollId: 'loser-punishment', // still open (ranked + curated)
  },

  // ─── Rules ────────────────────────────────────────────────────────────
  {
    key: 'missed-deadline',
    label: 'Missed Deadline',
    category: 'rules',
    approvalRule: 'poll',
    pollId: 'miss-deadline-penalty',
  },
  {
    key: 'tie-breaker',
    label: 'Tie-breaker',
    category: 'rules',
    approvalRule: 'poll',
    pollId: 'tie-breaker',
  },
  {
    key: 'mid-season-catchup',
    label: 'Mid-season Catch-up',
    category: 'rules',
    approvalRule: 'poll',
    pollId: 'mid-season-catchup',
  },

  // ─── Logistics ────────────────────────────────────────────────────────
  {
    key: 'commissioner',
    label: 'Commissioner',
    category: 'logistics',
    approvalRule: 'poll',
    pollId: 'commish-2026', // closed → "Tom"
  },
  {
    key: 'kickoff-meet',
    label: 'Watch Party',
    category: 'logistics',
    approvalRule: 'poll',
    pollId: 'kickoff-meet', // closed
  },
  {
    key: 'trophy',
    label: 'Trophy Plan',
    category: 'logistics',
    approvalRule: 'poll',
    pollId: 'trophy',
  },
]

// Realistic-feeling keeper roster — 12 players, all drafted in rounds 5+
// (since the rules prohibit keeping rounds 1–4 picks). Mix of year-1 and
// year-2 keepers so the table shows variety in cost.
const ELIGIBLE_KEEPERS: Array<Omit<KeeperRosterRow, 'userId'> & { memberSlot: number }> = [
  { memberSlot: 0, player: 'Justin Jefferson', position: 'WR', round: 5, yearOfKeep: 2 },
  { memberSlot: 1, player: 'Saquon Barkley', position: 'RB', round: 6, yearOfKeep: 1 },
  { memberSlot: 2, player: 'Tyreek Hill', position: 'WR', round: 7, yearOfKeep: 1 },
  { memberSlot: 3, player: 'CeeDee Lamb', position: 'WR', round: 5, yearOfKeep: 2 },
  { memberSlot: 4, player: 'Bijan Robinson', position: 'RB', round: 7, yearOfKeep: 1 },
  { memberSlot: 5, player: 'Travis Etienne', position: 'RB', round: 8, yearOfKeep: 1 },
  { memberSlot: 6, player: 'Garrett Wilson', position: 'WR', round: 9, yearOfKeep: 1 },
  { memberSlot: 7, player: 'Brock Purdy', position: 'QB', round: 12, yearOfKeep: 1 },
  { memberSlot: 8, player: 'Sam LaPorta', position: 'TE', round: 10, yearOfKeep: 1 },
  { memberSlot: 9, player: 'Puka Nacua', position: 'WR', round: 14, yearOfKeep: 1 },
  { memberSlot: 10, player: 'DeVonta Smith', position: 'WR', round: 6, yearOfKeep: 2 },
  { memberSlot: 11, player: 'Jared Goff', position: 'QB', round: 13, yearOfKeep: 1 },
];

// Helpers to resolve poll-derived values. The mock generator gets passed
// the polls roster so it can look up winners; we don't want a circular
// import with the polls module so the caller threads it in.

interface PollLike {
  id: string;
  status: string;
  options: Array<{ id: string; label: string }>;
  responses: Array<{
    choiceId: string | null;
    rankings: Array<{ choiceId: string; rank: number }> | null;
  }>;
  kind: string;
}

function winnerLabel(poll: PollLike | undefined): string | null {
  if (!poll) return null;
  if (poll.kind === 'single') {
    const counts = new Map<string, number>();
    for (const r of poll.responses) {
      if (r.choiceId) counts.set(r.choiceId, (counts.get(r.choiceId) ?? 0) + 1);
    }
    const top = poll.options
      .map((o) => ({ label: o.label, n: counts.get(o.id) ?? 0 }))
      .sort((a, b) => b.n - a.n)[0];
    return top && top.n > 0 ? top.label : null;
  }
  if (poll.kind === 'ranked') {
    const RANK_VALS: Record<number, number> = { 1: 3, 2: 2, 3: 1 };
    const points = new Map<string, number>();
    for (const r of poll.responses) {
      for (const sel of r.rankings ?? []) {
        points.set(
          sel.choiceId,
          (points.get(sel.choiceId) ?? 0) + (RANK_VALS[sel.rank] ?? 0)
        );
      }
    }
    const top = poll.options
      .map((o) => ({ label: o.label, n: points.get(o.id) ?? 0 }))
      .sort((a, b) => b.n - a.n)[0];
    return top && top.n > 0 ? top.label : null;
  }
  return null;
}

export interface GenerateCharterOptions {
  leagueId: string;
  members: User[];
  viewerId: string;
  now: Date;
  season: string;
  polls: PollLike[];
}

export function generateMockCharter({
  members,
  viewerId,
  now,
  season,
  polls,
}: GenerateCharterOptions): CharterEntry[] {
  const pollById = new Map<string, PollLike>(polls.map((p) => [p.id, p]));
  const fallbackProposer = members.find((m) => m.id !== viewerId)?.id ?? viewerId;
  return CHARTER_TEMPLATES.map((tpl) => {
    const id = `${season}::${tpl.key}`;
    let value: string | null = null;
    let status: CharterStatus = 'draft';
    let lockedAt: string | null = null;
    let pending: CharterPending | null = null;
    let proposedBy: string | null = null;
    let proposedAt: string | null = null;

    // Derive from a poll if linked: closed poll with a winner → locked
    // with that winner's label. Open poll → still draft.
    if (tpl.pollId) {
      const poll = pollById.get(tpl.pollId);
      if (poll?.status === 'closed') {
        const winner = winnerLabel(poll);
        if (winner) {
          value = winner;
          status = 'locked';
          // Snap locked-at to whenever the poll closed if we can, else
          // a recent timestamp.
          lockedAt = new Date(now.getTime() - 86400_000).toISOString();
        }
      }
    }

    // Manual locked override (used by templates without a poll).
    if (tpl.manualValue && tpl.lockedDaysAgo != null) {
      value = tpl.manualValue;
      status = 'locked';
      lockedAt = new Date(
        now.getTime() - tpl.lockedDaysAgo * 86400_000
      ).toISOString();
    }

    // Pending proposal overrides everything (mutually exclusive with
    // 'locked' in the mock).
    if (tpl.pending) {
      status = 'pending';
      const proposer =
        tpl.pending.proposedBy === 'self' ? viewerId : fallbackProposer;
      const approvalsFromOthers = tpl.pending.approvalsFromOthers;
      const otherMembers = members.filter(
        (m) => m.id !== viewerId && m.id !== proposer
      );
      const approvalsList: CharterApproval[] = otherMembers
        .slice(0, approvalsFromOthers)
        .map((m) => ({
          userId: m.id,
          approved: true,
          approvedAt: new Date(
            now.getTime() - Math.floor(Math.random() * 86400_000 * 2)
          ).toISOString(),
        }));
      if (tpl.pending.viewerApproved) {
        approvalsList.push({
          userId: viewerId,
          approved: true,
          approvedAt: new Date(now.getTime() - 86400_000).toISOString(),
        });
      }
      pending = {
        value: tpl.pending.value,
        proposedBy: proposer,
        proposedAt: new Date(
          now.getTime() - tpl.pending.proposedDaysAgo * 86400_000
        ).toISOString(),
        approvals: approvalsList,
      };
      proposedBy = proposer;
      proposedAt = pending.proposedAt;
      value = null;
      lockedAt = null;
    }

    // Attach the eligible-keepers roster as metadata when requested.
    // The EntryDock's expanded action panel renders this as a table.
    let metadata: CharterEntry['metadata'] | undefined
    if (tpl.attachKeeperRoster) {
      const otherMembers = members.filter((m) => m.id !== viewerId)
      const roster: KeeperRosterRow[] = ELIGIBLE_KEEPERS.flatMap((row) => {
        // Member slot 0 is the viewer (so the viewer always has a keeper
        // visible); slots 1+ pick from the other members in order.
        let userId: string
        if (row.memberSlot === 0) {
          userId = viewerId
        } else {
          const m = otherMembers[(row.memberSlot - 1) % Math.max(1, otherMembers.length)]
          if (!m) return []
          userId = m.id
        }
        return [{ userId, player: row.player, position: row.position, round: row.round, yearOfKeep: row.yearOfKeep }]
      })
      metadata = { keeperRoster: roster }
    }

    return {
      id,
      key: tpl.key,
      label: tpl.label,
      category: tpl.category,
      value,
      description: tpl.description ?? null,
      season,
      source: tpl.pollId ? 'derived-from-poll' : 'manual',
      pollId: tpl.pollId ?? null,
      approvalRule: tpl.approvalRule,
      threshold: tpl.threshold ?? null,
      status,
      proposedBy,
      proposedAt,
      lockedAt,
      pending,
      ...(metadata ? { metadata } : {}),
    };
  });
}

// Public-facing template list — used by the Neon adapter to seed the
// standard charter set when a new league/season is created.
export const STANDARD_CHARTER_TEMPLATES = CHARTER_TEMPLATES;
export type StandardCharterTemplate = (typeof STANDARD_CHARTER_TEMPLATES)[number];
