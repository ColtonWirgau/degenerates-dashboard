// Mock offseason / preseason polls — generated per league. Until the real
// `polls` + `poll_responses` schema lands in Phase C (see PLAN.md), this
// module synthesizes a realistic dataset directly from fixture members so
// the offseason dual-dock has something to render.
//
// Deterministic per-league: same league + same member roster produces the
// same poll distribution every page load, so screenshots / smoke tests
// stay stable.

import type { User } from './types';

export type PollKind = 'single' | 'multi' | 'ranked';

export interface RankedSelection {
  choiceId: string;
  /** 1 = top pick, 2 = runner-up, etc. Capped by `LeaguePoll.maxRanks`. */
  rank: number;
}

/**
 * Lifecycle states adopted from the polls-research synthesis (see PLAN.md).
 *   - `draft`    — admin is composing; not visible to members
 *   - `open`     — accepting votes / submissions; appears in bottom-dock queue
 *   - `closed`   — voting locked; results still visible in the top dock
 *                  (Discord "final results" treatment). Skipped by the
 *                  bottom-dock nav queue.
 *   - `archived` — dropped from both surfaces; still queryable by id for
 *                  long-tail history reads
 */
export type PollStatus = 'draft' | 'open' | 'closed' | 'archived';

/** Up/down reaction on a *pending* poll option (curated polls only).
 *  Approved options use the real vote mechanic; reactions are a
 *  community-signal layer that helps the commish decide what to
 *  promote out of the pending lane. */
export interface OptionReaction {
  userId: string;
  value: 1 | -1;
  at: string;
}

export interface PollOption {
  id: string;
  label: string;
  /** Optional one-line context shown under the option label. */
  hint?: string;
  /** Who added this option. For closed polls this is the poll creator;
   *  for open/curated polls it's the member who proposed it. */
  addedBy: string;
  addedAt: string;
  /** `approved` = votable. `pending` = awaiting commish approval
   *  (curated polls). Closed/open polls never have pending options —
   *  options go straight to approved. */
  status: 'approved' | 'pending';
  /** Up/down reactions — populated only on `pending` options as a
   *  community signal during curation. Ignored for approved options. */
  reactions: OptionReaction[];
}

/** Controls who can add options to a poll. Per-poll setting (no
 *  per-league default — keeps the model simple, matches consumer poll
 *  tools like Polly/StrawPoll/Doodle). */
export type PollOptionPolicy = 'closed' | 'open' | 'curated';

export interface PollResponse {
  userId: string;
  /** Set for `single` polls; null otherwise. */
  choiceId: string | null;
  /** Set for `multi` polls — every option the voter selected. Optional
   *  so legacy fixtures don't need to carry it. */
  choiceIds?: string[] | null;
  /** Set for `open` polls; null otherwise. */
  text: string | null;
  /** Set for `ranked` polls — ordered preferences capped by `maxRanks`.
   *  Null for other kinds. */
  rankings: RankedSelection[] | null;
  submittedAt: string;
}

export interface LeaguePoll {
  id: string;
  title: string;
  prompt: string;
  /** Tone — purely visual / categorical. Drives the eyebrow chip. */
  topic: 'punishment' | 'payout' | 'rules' | 'season' | 'fun' | 'logistics';
  kind: PollKind;
  status: PollStatus;
  /** Who can add options to this poll. */
  optionPolicy: PollOptionPolicy;
  /** Empty array for `open`-kind polls (legacy). */
  options: PollOption[];
  /** For `ranked` polls — how many ranks a voter may assign. Null for
   *  non-ranked kinds. */
  maxRanks: number | null;
  responses: PollResponse[];
  /** When true, non-creators see only the aggregate — never per-voter
   *  picks. Open-text responses are still attributed because the text
   *  itself is identifying. */
  isAnonymous: boolean;
  /** When this poll was derived from an earlier open-text "submission"
   *  poll (the two-phase flow), points back to that source poll's id.
   *  Null otherwise. */
  parentPollId: string | null;
  createdBy: string;
  createdAt: string;
  /** Optional auto-close timestamp. Past this point the poll moves to
   *  `closed`. Null means manual close only. */
  closesAt: string | null;
  /** Set when status transitions to `closed`. Null while still open. */
  closedAt: string | null;
  /** Set when status transitions to `archived`. Null otherwise. */
  archivedAt: string | null;
}

// ─── Poll templates ─────────────────────────────────────────────────────────

interface PollTemplate {
  id: string;
  title: string;
  prompt: string;
  topic: LeaguePoll['topic'];
  kind: PollKind;
  /** Lifecycle state. Defaults to 'open'. */
  status?: PollStatus;
  /** Who can add options. Defaults to 'closed' (admin/creator set). */
  optionPolicy?: PollOptionPolicy;
  /** When the source for a derived single-choice poll, point children at
   *  this id via `derivedFrom`. */
  parentPollId?: string;
  /** True for anonymous polls — UI hides per-voter picks. */
  isAnonymous?: boolean;
  options?: Array<{ id: string; label: string; hint?: string }>;
  /** Additional pending options for curated polls — proposed by members
   *  but not yet ratified by the commish. Mock data only; real submission
   *  flow lands with the schema. Each entry simulates a member's pitch
   *  and a sprinkle of community up/down reactions. */
  pendingOptions?: Array<{
    id: string;
    label: string;
    hint?: string;
    /** Slot index into the shuffled non-viewer member list — picks the
     *  pseudo-author deterministically per league. */
    authorSlot: number;
    /** How many up/down reactions to seed (others in the league). */
    upvotes: number;
    downvotes: number;
  }>;
  /** For single-choice polls: rough vote distribution over options (must
   *  sum loosely to <= total members; remainder = skipped). */
  voteShare?: number[];
  /** For ranked polls — how many ranks a voter may assign. Default 3. */
  maxRanks?: number;
  /** For ranked polls — distribution of 1st/2nd/3rd-place votes per
   *  option (parallel to `options`). Generator picks the top-share option
   *  as each member's #1, second-share as #2, etc., with shuffling. */
  rankShares?: Array<{ first: number; second: number; third: number }>;
  /** Approximate days-ago the poll was opened. */
  daysAgo: number;
  /** Optional auto-close, expressed as days from now. Positive = future. */
  closesInDays?: number;
  /** Required when status === 'closed' — how long ago it closed. */
  closedDaysAgo?: number;
}

// Polls are *structured votes* (single-choice or ranked) that close at a
// deadline and produce a result. Open-ended idea submissions live in
// `SUGGESTION_TEMPLATES` below — those become the "Suggestions" inbox the
// league uses to crowdsource future polls / rule changes / prop bet ideas.
// Schema-wise the two are separate now: polls and suggestions don't share
// types or generation logic, even though they sit on the same page.
const TEMPLATES: PollTemplate[] = [
  {
    // Curated from the punishment suggestions inbox — admin picked the top
    // 5 and put them up for a ranked-choice vote. Linked back via
    // `derivedFromSuggestionCategory` so the UI can hint at the lineage.
    id: 'loser-punishment',
    title: 'Loser punishment — rank your top 3',
    prompt: 'Rank your top 3 punishments for the season loser.',
    topic: 'punishment',
    kind: 'ranked',
    // Curated: commish promoted the 5 approved options below; members
    // can pitch more (showing up in the `pending` lane) and the league
    // upvotes/downvotes them to help the commish decide what else to
    // promote into the ranked vote.
    optionPolicy: 'curated',
    maxRanks: 3,
    daysAgo: 12,
    closesInDays: 9,
    options: [
      { id: 'jersey', label: 'Wear a rivalry jersey to the next game watch', hint: 'Winner picks the team.' },
      { id: 'tattoo', label: 'Small league-trophy tattoo', hint: 'Location TBD by the group.' },
      { id: 'karaoke', label: 'Karaoke night, song picked by the winner' },
      { id: 'dinner', label: 'Buy the league dinner — full-bar tab included' },
      { id: 'champs-choice', label: "Champion's choice — they design the punishment" },
    ],
    pendingOptions: [
      {
        id: 'highlight-reel',
        label: 'Cut a 60-second highlight reel of your own worst picks',
        hint: 'Posted in the league chat, no edits allowed',
        authorSlot: 0,
        upvotes: 6,
        downvotes: 1,
      },
      {
        id: 'apology-speech',
        label: 'Prepared apology speech at the next league dinner',
        authorSlot: 1,
        upvotes: 4,
        downvotes: 2,
      },
      {
        id: 'live-tweet-draft',
        label: "Live-tweet next year's draft in character as the season MVP",
        hint: 'Submitted by you',
        authorSlot: 2,
        upvotes: 3,
        downvotes: 3,
      },
    ],
    // Per-option distribution of 1st/2nd/3rd-place votes. Generator fans
    // these out across non-viewer members. Numbers parallel `options`.
    rankShares: [
      { first: 1, second: 3, third: 2 }, // jersey
      { first: 2, second: 1, third: 2 }, // tattoo
      { first: 1, second: 3, third: 3 }, // karaoke
      { first: 1, second: 1, third: 1 }, // dinner
      { first: 5, second: 1, third: 1 }, // champs-choice — winning 1st-place
    ],
  },
  {
    id: 'miss-deadline-penalty',
    title: 'Missing the deadline',
    prompt: 'What happens if someone misses the submission deadline?',
    topic: 'rules',
    kind: 'single',
    daysAgo: 11,
    options: [
      { id: 'auto-loss', label: 'Auto-loss — their leg counts as -110 loser' },
      { id: 'freebie', label: 'League gets a freebie — pick anything for them' },
      { id: 'punishment-vote', label: 'End-of-season punishment vote' },
      { id: 'random-sub', label: 'Random league member submits a leg for them' },
    ],
    voteShare: [4, 3, 2, 1],
  },
  {
    id: 'tie-breaker',
    title: 'Tie-breaker rule',
    prompt: 'If two teams finish tied at season end, how do we break it?',
    topic: 'rules',
    kind: 'single',
    daysAgo: 9,
    options: [
      { id: 'h2h', label: 'Head-to-head record' },
      { id: 'most-weekly', label: 'Most weekly wins' },
      { id: 'coin-flip', label: 'Coin flip' },
      { id: 'sudden-death', label: 'One-week sudden-death parlay' },
    ],
    voteShare: [3, 2, 0, 6], // sudden-death wins
  },
  {
    id: 'mid-season-catchup',
    title: 'Mid-season catch-up',
    prompt: 'Should the bottom 3 get a do-over reset mid-season?',
    topic: 'season',
    kind: 'single',
    daysAgo: 7,
    options: [
      { id: 'yes-all', label: 'Yes — bottom 3 reset to 0' },
      { id: 'yes-last', label: 'Yes, but only for the last-place member' },
      { id: 'no', label: 'No — suffer for your sins' },
      { id: 'vote-each-year', label: 'Decide each season by vote' },
    ],
    voteShare: [1, 2, 5, 2],
  },
  {
    id: 'trophy',
    title: 'Real-life trophy',
    prompt: 'Do we get an actual trophy for the winner to keep year-over-year?',
    topic: 'fun',
    kind: 'single',
    daysAgo: 5,
    options: [
      { id: 'yes-dues', label: 'Yes — dues cover the cost' },
      { id: 'yes-winner-pays', label: 'Yes — last winner pays it forward' },
      { id: 'plaque', label: 'Custom plaque per season (cheaper, accumulates)' },
      { id: 'no', label: 'No — virtual trophy is fine' },
    ],
    voteShare: [4, 1, 4, 2],
  },
  // Open — draft date poll still being voted on. Powers the donut
  // chart on the Date PeekCard.
  {
    id: 'draft-date',
    title: 'Draft date',
    prompt: 'Which dates work for you? Pick every one you can make — most available wins.',
    topic: 'logistics',
    kind: 'multi',
    daysAgo: 8,
    closesInDays: 14,
    options: [
      { id: 'sat-aug-29', label: 'Sat, Aug 29 · 1pm' },
      { id: 'sun-aug-30', label: 'Sun, Aug 30 · 1pm' },
      { id: 'sat-sep-5', label: 'Sat, Sep 5 · 6pm' },
      { id: 'sun-sep-6', label: 'Sun, Sep 6 · 1pm' },
    ],
    voteShare: [2, 5, 1, 3], // Sun Aug 30 leading
  },

  // Recently-closed polls — fuel the "Just Locked" feature card. Real
  // mock results from earlier votes that wrapped up in the last week.
  {
    id: 'draft-format',
    title: 'Draft format',
    prompt: 'How do we run the draft this year?',
    topic: 'logistics',
    kind: 'single',
    status: 'closed',
    daysAgo: 30,
    closedDaysAgo: 1,
    options: [
      { id: 'snake', label: 'Snake draft — old reliable' },
      { id: 'auction', label: 'Auction draft — bring your wallet' },
      { id: 'linear', label: 'Linear draft — first pick keeps picking first' },
    ],
    voteShare: [8, 3, 1],
  },
  {
    id: 'kickoff-meet',
    title: 'Kickoff meet-up location',
    prompt: 'Where do we gather for the Week 1 watch party?',
    topic: 'logistics',
    kind: 'single',
    status: 'closed',
    daysAgo: 22,
    closedDaysAgo: 2,
    options: [
      { id: 'tom-house', label: "Tom's place — the usual" },
      { id: 'sports-bar', label: "Buffalo Wild Wings — the big screens" },
      { id: 'rotate', label: 'Rotating host each week' },
    ],
    voteShare: [4, 6, 2],
  },
  {
    id: 'commish-2026',
    title: 'Commissioner for 2026',
    prompt: 'Who runs the league this year?',
    topic: 'logistics',
    kind: 'single',
    status: 'closed',
    daysAgo: 28,
    closedDaysAgo: 3,
    options: [
      { id: 'tom', label: 'Tom — defending commish' },
      { id: 'andrew', label: 'Andrew — fresh blood' },
      { id: 'mike', label: 'Mike — ran it two years ago' },
    ],
    voteShare: [7, 3, 2],
  },
];

// ─── Generation ─────────────────────────────────────────────────────────────

/** Mulberry32 — small deterministic PRNG keyed off the league id. */
function seededRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

interface GenerateOptions {
  leagueId: string;
  members: User[];
  /** ID of the viewer — controls which polls they've voted on already. */
  viewerId: string;
  /** "Now" — used to backdate `submittedAt` and `createdAt`. */
  now: Date;
  /** When true, every open poll is treated as already answered by the
   *  viewer — useful for preseason demos where the league has wrapped up
   *  its decisions and the dock should land on the completion card. */
  viewerAnsweredEverything?: boolean;
}

// Polls the viewer has already responded to before the page loads. Keeps
// the demo lively while leaving the rest actionable in the bottom dock.
const VIEWER_PRE_VOTED_IDS = new Set([
  'draft-format',
  'commish-2026',
  'kickoff-meet',
]);

/**
 * Builds a deterministic, viewer-aware poll set for a league. Responses
 * are seeded from member fixtures; the viewer has pre-existing answers on
 * a hand-picked subset (see `VIEWER_PRE_VOTED_IDS`) so the demo surfaces
 * both "you voted" treatments and unanswered prompts side-by-side.
 */
export function generateMockPolls({
  leagueId,
  members,
  viewerId,
  now,
  viewerAnsweredEverything = false,
}: GenerateOptions): LeaguePoll[] {
  const rng = seededRng(leagueId);
  const otherMembers = members.filter((m) => m.id !== viewerId);
  // Use the first non-viewer member as the mock "creator" of all polls;
  // when admin tooling lands they'll have real attribution.
  const fallbackCreator = otherMembers[0]?.id ?? viewerId;

  return TEMPLATES.map((tpl) => {
    const createdAt = new Date(now.getTime() - tpl.daysAgo * 86400_000).toISOString();
    const status: PollStatus = tpl.status ?? 'open';
    const closesAt =
      tpl.closesInDays != null
        ? new Date(now.getTime() + tpl.closesInDays * 86400_000).toISOString()
        : null;
    const closedAt =
      status === 'closed' && tpl.closedDaysAgo != null
        ? new Date(now.getTime() - tpl.closedDaysAgo * 86400_000).toISOString()
        : null;
    const responses: PollResponse[] = [];

    if (tpl.kind === 'single' && tpl.options && tpl.voteShare) {
      // Distribute `voteShare[i]` votes across the option, taking pseudo-
      // random members for each slot. Skipped members are the remainder.
      const assignedOptionByIdx = new Map<number, string>();
      let cursor = 0;
      for (let i = 0; i < tpl.voteShare.length; i++) {
        const count = tpl.voteShare[i]!;
        for (let k = 0; k < count; k++) {
          assignedOptionByIdx.set(cursor + k, tpl.options[i]!.id);
        }
        cursor += count;
      }
      // Shuffle the slot → member mapping deterministically.
      const shuffled = [...otherMembers].sort(() => rng() - 0.5);
      shuffled.forEach((member, idx) => {
        const optionId = assignedOptionByIdx.get(idx);
        if (!optionId) return; // skipped
        responses.push({
          userId: member.id,
          choiceId: optionId,
          text: null,
          rankings: null,
          submittedAt: new Date(
            now.getTime() - (tpl.daysAgo - 1) * 86400_000 - Math.floor(rng() * 86400_000)
          ).toISOString(),
        });
      });

      if (viewerAnsweredEverything || VIEWER_PRE_VOTED_IDS.has(tpl.id)) {
        const myChoice = tpl.options[Math.floor(rng() * tpl.options.length)]!.id;
        responses.push({
          userId: viewerId,
          choiceId: myChoice,
          text: null,
          rankings: null,
          submittedAt: new Date(now.getTime() - 3 * 86400_000).toISOString(),
        });
      }
    } else if (tpl.kind === 'ranked' && tpl.options) {
      const maxRanks = tpl.maxRanks ?? 3;
      // Skip 1 random member; the rest cast a ballot.
      const shuffled = [...otherMembers].sort(() => rng() - 0.5);
      const participating = shuffled.slice(0, Math.max(0, shuffled.length - 1));
      participating.forEach((member) => {
        // Per-member deterministic shuffle seeded off (member, poll) so
        // re-runs produce the same ballots and the aggregate tally is
        // stable across reloads.
        const memberRng = seededRng(`${member.id}::${tpl.id}`);
        const memberShuffled = [...tpl.options!].sort(() => memberRng() - 0.5);
        const rankings: RankedSelection[] = memberShuffled
          .slice(0, maxRanks)
          .map((opt, rankIdx) => ({ choiceId: opt.id, rank: rankIdx + 1 }));
        responses.push({
          userId: member.id,
          choiceId: null,
          text: null,
          rankings,
          submittedAt: new Date(
            now.getTime() - (tpl.daysAgo - 1) * 86400_000 - Math.floor(memberRng() * 86400_000)
          ).toISOString(),
        });
      });
      if (viewerAnsweredEverything || VIEWER_PRE_VOTED_IDS.has(tpl.id)) {
        const viewerRng = seededRng(`${viewerId}::${tpl.id}`);
        const viewerShuffled = [...tpl.options!].sort(() => viewerRng() - 0.5);
        const rankings: RankedSelection[] = viewerShuffled
          .slice(0, maxRanks)
          .map((opt, rankIdx) => ({ choiceId: opt.id, rank: rankIdx + 1 }));
        responses.push({
          userId: viewerId,
          choiceId: null,
          text: null,
          rankings,
          submittedAt: new Date(now.getTime() - 3 * 86400_000).toISOString(),
        });
      }
    }

    return {
      id: tpl.id,
      title: tpl.title,
      prompt: tpl.prompt,
      topic: tpl.topic,
      kind: tpl.kind,
      status,
      optionPolicy: tpl.optionPolicy ?? 'closed',
      // Approved options — added by the creator (or commish) at poll
      // creation time. Status is `approved` by default; reactions empty
      // since approved options use the real vote mechanic.
      options: (tpl.options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        hint: o.hint,
        addedBy: fallbackCreator,
        addedAt: createdAt,
        status: 'approved' as const,
        reactions: [],
      })),
      maxRanks: tpl.kind === 'ranked' ? tpl.maxRanks ?? 3 : null,
      responses,
      isAnonymous: tpl.isAnonymous ?? false,
      parentPollId: tpl.parentPollId ?? null,
      createdBy: fallbackCreator,
      createdAt,
      closesAt,
      closedAt,
      archivedAt: null,
      // Pending options come second on the array — they sit in their
      // own UI lane and aren't included in the real vote tally.
    };
  }).map((poll, i) => {
    const tpl = TEMPLATES[i]!;
    if (!tpl.pendingOptions || tpl.pendingOptions.length === 0) return poll;
    const otherMembers = members.filter((m) => m.id !== viewerId);
    const shuffled = [...otherMembers].sort(() => seededRng(`${poll.id}::pending`)() - 0.5);
    const rng = seededRng(`${poll.id}::reactions`);
    const pending: PollOption[] = tpl.pendingOptions.map((p) => {
      const author = shuffled[p.authorSlot % Math.max(1, shuffled.length)] ?? otherMembers[0];
      const authorId = author?.id ?? fallbackCreator;
      // For the "live-tweet draft" option in the mock, swap author to
      // the viewer so the UI can highlight "Submitted by you".
      const isViewerSubmission = p.id === 'live-tweet-draft';
      const finalAuthorId = isViewerSubmission ? viewerId : authorId;
      // Seed up/down reactions. Pull non-author members and split per
      // the requested counts.
      const reactorPool = members.filter((m) => m.id !== finalAuthorId);
      const reactorShuffled = [...reactorPool].sort(() => rng() - 0.5);
      const ups = reactorShuffled.slice(0, p.upvotes).map((m) => ({
        userId: m.id,
        value: 1 as const,
        at: new Date(now.getTime() - Math.floor(rng() * 86400_000 * 3)).toISOString(),
      }));
      const downs = reactorShuffled.slice(p.upvotes, p.upvotes + p.downvotes).map((m) => ({
        userId: m.id,
        value: -1 as const,
        at: new Date(now.getTime() - Math.floor(rng() * 86400_000 * 3)).toISOString(),
      }));
      return {
        id: p.id,
        label: p.label,
        hint: p.hint,
        addedBy: finalAuthorId,
        addedAt: new Date(
          now.getTime() - Math.floor(rng() * 86400_000 * 5)
        ).toISOString(),
        status: 'pending' as const,
        reactions: [...ups, ...downs],
      };
    });
    return { ...poll, options: [...poll.options, ...pending] };
  });
}

// Public-facing template list — used by the Neon adapter to seed the
// standard set of polls when a new league starts a season. The mock
// `id` field is treated as a stable *template key* on the Neon side
// (we map mockId → real UUID at seed time + use it as the join key
// for the charter back-fill).
export const STANDARD_POLL_TEMPLATES = TEMPLATES;
export type StandardPollTemplate = (typeof STANDARD_POLL_TEMPLATES)[number];

