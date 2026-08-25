// Places on the board, with ties.
//
// Numbering rows 1..n by their position says Ashton finished 9th and
// Andrew 8th when both went 7–8. They finished level. So this is standard
// competition ranking: equal records share a place, and the places after
// a tie skip by as many as were tied — three people level on 7th are all
// 7th, and the next one down is 10th.
//
// "Equal" means the RECORD, not the rate. 9–6 and 6–4 are both 60% and
// are not the same season, so they don't share a place.

export interface RankableRecord {
  wins: number
  losses: number
  pushes: number
}

const sameRecord = (a: RankableRecord, b: RankableRecord) =>
  a.wins === b.wins && a.losses === b.losses && a.pushes === b.pushes

/**
 * Ranks for an already-sorted list, parallel to it.
 *
 * It only compares each row with the one above, which is safe because
 * every board in this app sorts by wins and then rate — so identical
 * records are always adjacent. A different sort would need a different
 * approach, and would also be a different board.
 */
export function assignRanks(sorted: RankableRecord[]): number[] {
  const ranks: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sameRecord(sorted[i]!, sorted[i - 1]!)) {
      ranks.push(ranks[i - 1]!)
    } else {
      ranks.push(i + 1)
    }
  }
  return ranks
}

/**
 * The one sort every board in this app uses: most wins, then the better
 * rate, then alphabetical so it's stable. Kept here so the season recap
 * and the board panel can't drift into ordering people differently.
 */
export function compareForBoard(
  a: RankableRecord & { winRate: number; name: string },
  b: RankableRecord & { winRate: number; name: string }
): number {
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.winRate !== a.winRate) return b.winRate - a.winRate
  return a.name.localeCompare(b.name)
}
