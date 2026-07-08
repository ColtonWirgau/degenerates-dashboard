// Realistic leg description / odds samples drawn from the live data
// snapshot. Used by the mock adapter to populate weeks with believable
// content. Mix of spreads, moneyline, totals, props.

interface LegSample {
  description: string;
  odds: number;
}

const SPREADS: LegSample[] = [
  { description: 'Bills -6.5', odds: -110 },
  { description: 'Eagles -4', odds: -115 },
  { description: 'Chiefs -3.5', odds: -110 },
  { description: '49ers -7.5', odds: 105 },
  { description: 'Lions -7', odds: -120 },
  { description: 'Cowboys -2.5', odds: -110 },
  { description: 'Patriots +7', odds: 110 },
  { description: 'Titans +3.5', odds: -115 },
  { description: 'Cardinals +8.5', odds: 105 },
  { description: 'Bears +7', odds: -110 },
  { description: 'Jets +4', odds: -110 },
  { description: 'Raiders +5.5', odds: -115 },
  { description: 'Vikings -5', odds: -105 },
  { description: 'Seahawks -2', odds: -120 },
  { description: 'Jaguars +1.5', odds: -110 },
];

const MONEYLINES: LegSample[] = [
  { description: 'Bills ML', odds: -250 },
  { description: 'Chiefs ML', odds: -180 },
  { description: 'Eagles ML', odds: -160 },
  { description: 'Lions ML', odds: -200 },
  { description: 'Broncos ML', odds: 105 },
  { description: 'Cowboys ML', odds: 120 },
  { description: 'Jets ML', odds: -125 },
  { description: '49ers ML', odds: -115 },
];

const PROPS: LegSample[] = [
  { description: 'Mahomes 250+ pass yds', odds: -110 },
  { description: 'CMC 100+ rush yds', odds: 110 },
  { description: 'Kelce 60+ rec yds', odds: -120 },
  { description: 'Josh Allen 2+ pass TDs', odds: -130 },
  { description: 'Jefferson 75+ rec yds', odds: -115 },
  { description: 'Jalen Hurts ATD', odds: 130 },
  { description: 'Chase Brown 50+ rush yds', odds: -110 },
  { description: 'Davante Adams ATD', odds: 200 },
  { description: 'Breece Hall ATD', odds: 145 },
  { description: 'Travis Etienne 60+ rush yds', odds: -110 },
  { description: 'Kincaid 30+ rec yds', odds: -125 },
  { description: 'Geno Smith 1+ INT', odds: 110 },
  { description: 'Bucky Irving ATD', odds: 175 },
  { description: 'Micah Parsons 1+ Sack', odds: 140 },
  { description: 'Josh Jacobs ATD', odds: 130 },
  { description: 'Tyreek Hill 80+ rec yds', odds: -115 },
];

const TOTALS: LegSample[] = [
  { description: 'Bills/Chiefs OVER 49.5', odds: -110 },
  { description: 'Cowboys/Eagles UNDER 47', odds: -115 },
  { description: 'Lions/Vikings OVER 51.5', odds: -110 },
  { description: 'Jets/Pats UNDER 38.5', odds: -110 },
  { description: 'Niners/Rams OVER 47.5', odds: -105 },
];

export const LEG_POOL: LegSample[] = [
  ...SPREADS,
  ...MONEYLINES,
  ...PROPS,
  ...TOTALS,
];

/**
 * Deterministic pseudo-random sample. Same seed → same legs, so a given
 * (parlay, user, scenario) tuple always picks the same leg description.
 */
export function pickLegSample(seed: string): LegSample {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const idx = Math.abs(h) % LEG_POOL.length;
  return LEG_POOL[idx];
}
