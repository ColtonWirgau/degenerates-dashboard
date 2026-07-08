// Scenarios — named slices of "what time is it / where in the season are we"
// that the mock adapter uses to synthesize realistic data for UI testing.
//
// To add a scenario: drop another entry in SCENARIOS. The dev toolbar reads
// from this list automatically.

export interface Scenario {
  id: string;
  /** Display label in the dev toolbar. */
  name: string;
  /** One-line hint about what this scenario exercises. */
  hint: string;
  /** ISO timestamp clamped as `now` while this scenario is active. */
  now: string;
  /** Which NFL season the league is currently playing. Format: '2025-2026'. */
  currentSeason: string;
  /** Optional: force the active week to N (otherwise derived from `now`).
   *  Useful for "halfway through week 5 with only 4 of 12 submitted" kinds
   *  of states the natural calendar wouldn't produce on demand. */
  forceWeekNumber?: number;
  /** Per-active-week fine-tuning. */
  weekState?: {
    /** Fraction (0–1) of league members who've submitted their leg. */
    submittedRatio?: number;
    /** Are submitted legs locked? Default: true. */
    locked?: boolean;
    /** When true, treat the active week as already graded — every leg gets
     *  a result. Used for the "midseason — week graded" scenario where the
     *  forced week is technically still "current" by date but the games
     *  have played. */
    graded?: boolean;
    /** Fraction (0–1) of submitted legs that have settled while the rest
     *  are still pending (games in progress). Lower-priority than `graded`.
     *  Settled legs default to `win` so the parlay stays alive — flip to
     *  the all-or-nothing bust state by adding a manual loss override. */
    gradedRatio?: number;
  };
}

const ET = 'America/New_York';

const at = (date: string, time = '13:15:00') => {
  // Construct a UTC ISO from an ET wall-clock — week kickoffs are 9:15 AM ET
  // which is 13:15 UTC during EDT, 14:15 during EST. Keep simple by always
  // using EDT (most of the season). Close enough for mocks.
  return `${date}T${time}+00:00`;
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'offseason-deep',
    name: 'Offseason — schedule TBD',
    hint: 'May. Last season is over, next season schedule not released. League has full history but no current week.',
    now: at('2026-05-15', '14:00:00'),
    currentSeason: '2026-2027',
  },
  {
    id: 'preseason-schedule-out',
    name: 'Preseason — schedule released',
    hint: 'Late August. Schedule is out, league has wrapped its offseason polls, kickoff in ~4 weeks. Bottom dock lands on the "all caught up" completion state; SchedulePreview renders Week 1.',
    // Inside the 60-day pre-kickoff cutoff so the adapter classifies this
    // as `preseason` (not `offseason`). Week 1 kickoff is roughly Sep 13
    // 2026 — this lands ~29 days out.
    now: at('2026-08-15', '14:00:00'),
    currentSeason: '2026-2027',
  },
  {
    id: 'opening-week-live',
    name: 'Opening week — live',
    hint: 'September week 1 is mid-submission. Some users locked in, others still drafting.',
    now: at('2026-09-09', '15:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 1,
    weekState: { submittedRatio: 0.5, locked: true },
  },
  {
    id: 'midseason-thursday',
    name: 'Midseason — Thursday before games',
    hint: 'Week 8 in flight. Half the league submitted, none locked-and-graded yet.',
    now: at('2026-10-29', '15:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 8,
    weekState: { submittedRatio: 0.6, locked: true },
  },
  {
    id: 'midseason-live',
    name: 'Midseason — games live',
    hint: 'Sunday afternoon week 8. Half the legs settled, rest still in play. Parlay alive — follow along.',
    now: at('2026-11-01', '17:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 8,
    weekState: { submittedRatio: 1, locked: true, gradedRatio: 0.5 },
  },
  {
    id: 'midseason-locked-pre-results',
    name: 'Midseason — locked, awaiting results',
    hint: 'Sunday morning week 8. Everyone\'s in. Games haven\'t finished. Result columns should show pending.',
    now: at('2026-11-01', '14:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 8,
    weekState: { submittedRatio: 1, locked: true },
  },
  {
    id: 'midseason-graded',
    name: 'Midseason — week graded',
    hint: 'Tuesday after week 8. Results in, league won/lost.',
    now: at('2026-11-03', '14:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 8,
    weekState: { submittedRatio: 1, locked: true, graded: true },
  },
  {
    id: 'playoffs-wildcard',
    name: 'Playoffs — wildcard weekend',
    hint: 'January, post-regular-season. NFL bracket round 1.',
    now: at('2027-01-13', '15:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 19,
    weekState: { submittedRatio: 0.7, locked: true },
  },
  {
    id: 'super-bowl',
    name: 'Super Bowl week',
    hint: 'The championship game. Same one-leg format as any other week.',
    now: at('2027-02-08', '15:00:00'),
    currentSeason: '2026-2027',
    forceWeekNumber: 22,
    weekState: { submittedRatio: 0.4, locked: true },
  },
];

export const DEFAULT_SCENARIO_ID = 'midseason-thursday';

export function getScenario(id: string | undefined | null): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS.find((s) => s.id === DEFAULT_SCENARIO_ID)!;
}
