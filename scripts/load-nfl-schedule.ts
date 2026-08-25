// CLI wrapper around `lib/nfl-schedule.ts`. Used for one-shot bootstrap
// and ad-hoc reloads (a postponement, a flex move). Also seeds nfl_teams
// since teams change rarely enough that a hand-curated list is fine.
//
// Usage:
//   npx tsx scripts/load-nfl-schedule.ts                    # current season + teams
//   npx tsx scripts/load-nfl-schedule.ts --year 2026
//   npx tsx scripts/load-nfl-schedule.ts --years 2023,2024,2025
//   npx tsx scripts/load-nfl-schedule.ts --from 2021 --to 2026   # backfill
//   npx tsx scripts/load-nfl-schedule.ts --year 2025 --weeks 10,11,12
//   npx tsx scripts/load-nfl-schedule.ts --teams-only       # refresh nfl_teams only
//
// Requires DATABASE_URL in .env.local.

import './load-env'

import { db } from '../db/client'
import { nflTeams } from '../db/schema'
import { WEEK_CATALOG } from '../lib/nfl-schedule'

// ─── Args ──────────────────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1 || idx === process.argv.length - 1) return undefined
  return process.argv[idx + 1]
}

const flag = (name: string) => process.argv.includes(`--${name}`)

// One season (--year 2026), an explicit list (--years 2023,2024,2025), or a
// range (--from 2021 --to 2026). Defaults to the current season year.
function defaultSeasonYear(): number {
  const now = new Date()
  const yr = now.getUTCFullYear()
  return now.getUTCMonth() + 1 >= 4 ? yr : yr - 1
}

function resolveYears(): number[] {
  const list = getArg('years')
  if (list) {
    return list
      .split(',')
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => Number.isFinite(n))
  }
  const from = getArg('from')
  const to = getArg('to')
  if (from && to) {
    const a = parseInt(from, 10)
    const b = parseInt(to, 10)
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      return Array.from({ length: b - a + 1 }, (_, i) => a + i)
    }
  }
  return [parseInt(getArg('year') ?? String(defaultSeasonYear()), 10)]
}

const years = resolveYears()
const weeksArg = getArg('weeks')
  ?.split(',')
  .map((n) => parseInt(n.trim(), 10))
  .filter((n) => Number.isFinite(n) && n >= 1 && n <= 22)
const teamsOnly = flag('teams-only')

// ─── Team catalog (static) ─────────────────────────────────────────────────

interface TeamSeed {
  abbr: string
  name: string
  city: string
  fullName: string
  conf: 'AFC' | 'NFC'
  div: 'East' | 'North' | 'South' | 'West'
  primary: string
  secondary: string
}

const TEAMS: TeamSeed[] = [
  { abbr: 'BUF', name: 'Bills', city: 'Buffalo', fullName: 'Buffalo Bills', conf: 'AFC', div: 'East', primary: '#00338D', secondary: '#C60C30' },
  { abbr: 'MIA', name: 'Dolphins', city: 'Miami', fullName: 'Miami Dolphins', conf: 'AFC', div: 'East', primary: '#008E97', secondary: '#FC4C02' },
  { abbr: 'NE', name: 'Patriots', city: 'New England', fullName: 'New England Patriots', conf: 'AFC', div: 'East', primary: '#002244', secondary: '#C60C30' },
  { abbr: 'NYJ', name: 'Jets', city: 'New York', fullName: 'New York Jets', conf: 'AFC', div: 'East', primary: '#125740', secondary: '#FFFFFF' },
  { abbr: 'BAL', name: 'Ravens', city: 'Baltimore', fullName: 'Baltimore Ravens', conf: 'AFC', div: 'North', primary: '#241773', secondary: '#9E7C0C' },
  { abbr: 'CIN', name: 'Bengals', city: 'Cincinnati', fullName: 'Cincinnati Bengals', conf: 'AFC', div: 'North', primary: '#FB4F14', secondary: '#000000' },
  { abbr: 'CLE', name: 'Browns', city: 'Cleveland', fullName: 'Cleveland Browns', conf: 'AFC', div: 'North', primary: '#311D00', secondary: '#FF3C00' },
  { abbr: 'PIT', name: 'Steelers', city: 'Pittsburgh', fullName: 'Pittsburgh Steelers', conf: 'AFC', div: 'North', primary: '#FFB612', secondary: '#101820' },
  { abbr: 'HOU', name: 'Texans', city: 'Houston', fullName: 'Houston Texans', conf: 'AFC', div: 'South', primary: '#03202F', secondary: '#A71930' },
  { abbr: 'IND', name: 'Colts', city: 'Indianapolis', fullName: 'Indianapolis Colts', conf: 'AFC', div: 'South', primary: '#002C5F', secondary: '#A2AAAD' },
  { abbr: 'JAX', name: 'Jaguars', city: 'Jacksonville', fullName: 'Jacksonville Jaguars', conf: 'AFC', div: 'South', primary: '#101820', secondary: '#D7A22A' },
  { abbr: 'TEN', name: 'Titans', city: 'Tennessee', fullName: 'Tennessee Titans', conf: 'AFC', div: 'South', primary: '#0C2340', secondary: '#4B92DB' },
  { abbr: 'DEN', name: 'Broncos', city: 'Denver', fullName: 'Denver Broncos', conf: 'AFC', div: 'West', primary: '#FB4F14', secondary: '#002244' },
  { abbr: 'KC', name: 'Chiefs', city: 'Kansas City', fullName: 'Kansas City Chiefs', conf: 'AFC', div: 'West', primary: '#E31837', secondary: '#FFB81C' },
  { abbr: 'LV', name: 'Raiders', city: 'Las Vegas', fullName: 'Las Vegas Raiders', conf: 'AFC', div: 'West', primary: '#000000', secondary: '#A5ACAF' },
  { abbr: 'LAC', name: 'Chargers', city: 'Los Angeles', fullName: 'Los Angeles Chargers', conf: 'AFC', div: 'West', primary: '#0080C6', secondary: '#FFC20E' },
  { abbr: 'DAL', name: 'Cowboys', city: 'Dallas', fullName: 'Dallas Cowboys', conf: 'NFC', div: 'East', primary: '#003594', secondary: '#869397' },
  { abbr: 'NYG', name: 'Giants', city: 'New York', fullName: 'New York Giants', conf: 'NFC', div: 'East', primary: '#0B2265', secondary: '#A71930' },
  { abbr: 'PHI', name: 'Eagles', city: 'Philadelphia', fullName: 'Philadelphia Eagles', conf: 'NFC', div: 'East', primary: '#004C54', secondary: '#A5ACAF' },
  { abbr: 'WSH', name: 'Commanders', city: 'Washington', fullName: 'Washington Commanders', conf: 'NFC', div: 'East', primary: '#5A1414', secondary: '#FFB612' },
  { abbr: 'CHI', name: 'Bears', city: 'Chicago', fullName: 'Chicago Bears', conf: 'NFC', div: 'North', primary: '#0B162A', secondary: '#C83803' },
  { abbr: 'DET', name: 'Lions', city: 'Detroit', fullName: 'Detroit Lions', conf: 'NFC', div: 'North', primary: '#0076B6', secondary: '#B0B7BC' },
  { abbr: 'GB', name: 'Packers', city: 'Green Bay', fullName: 'Green Bay Packers', conf: 'NFC', div: 'North', primary: '#203731', secondary: '#FFB612' },
  { abbr: 'MIN', name: 'Vikings', city: 'Minnesota', fullName: 'Minnesota Vikings', conf: 'NFC', div: 'North', primary: '#4F2683', secondary: '#FFC62F' },
  { abbr: 'ATL', name: 'Falcons', city: 'Atlanta', fullName: 'Atlanta Falcons', conf: 'NFC', div: 'South', primary: '#A71930', secondary: '#000000' },
  { abbr: 'CAR', name: 'Panthers', city: 'Carolina', fullName: 'Carolina Panthers', conf: 'NFC', div: 'South', primary: '#0085CA', secondary: '#101820' },
  { abbr: 'NO', name: 'Saints', city: 'New Orleans', fullName: 'New Orleans Saints', conf: 'NFC', div: 'South', primary: '#D3BC8D', secondary: '#101820' },
  { abbr: 'TB', name: 'Buccaneers', city: 'Tampa Bay', fullName: 'Tampa Bay Buccaneers', conf: 'NFC', div: 'South', primary: '#D50A0A', secondary: '#FF7900' },
  { abbr: 'ARI', name: 'Cardinals', city: 'Arizona', fullName: 'Arizona Cardinals', conf: 'NFC', div: 'West', primary: '#97233F', secondary: '#000000' },
  { abbr: 'LAR', name: 'Rams', city: 'Los Angeles', fullName: 'Los Angeles Rams', conf: 'NFC', div: 'West', primary: '#003594', secondary: '#FFA300' },
  { abbr: 'SF', name: '49ers', city: 'San Francisco', fullName: 'San Francisco 49ers', conf: 'NFC', div: 'West', primary: '#AA0000', secondary: '#B3995D' },
  { abbr: 'SEA', name: 'Seahawks', city: 'Seattle', fullName: 'Seattle Seahawks', conf: 'NFC', div: 'West', primary: '#002244', secondary: '#69BE28' },
]

// ESPN team logo CDN — public, no auth. Our abbrs are ESPN's own
// (WSH, JAX, LAR…), so lowercasing them addresses the CDN directly.
const logoUrlFor = (abbr: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`

async function seedTeams(): Promise<number> {
  for (const t of TEAMS) {
    await db
      .insert(nflTeams)
      .values({
        abbr: t.abbr,
        name: t.name,
        fullName: t.fullName,
        city: t.city,
        conference: t.conf,
        division: t.div,
        primaryColor: t.primary,
        secondaryColor: t.secondary,
        logoUrl: logoUrlFor(t.abbr),
      })
      .onConflictDoUpdate({
        target: nflTeams.abbr,
        set: {
          name: t.name,
          fullName: t.fullName,
          city: t.city,
          conference: t.conf,
          division: t.div,
          primaryColor: t.primary,
          secondaryColor: t.secondary,
          logoUrl: logoUrlFor(t.abbr),
        },
      })
  }
  return TEAMS.length
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏈  Seeding nfl_teams… `)
  const teamCount = await seedTeams()
  console.log(`    ${teamCount} teams ✓`)

  if (teamsOnly) {
    console.log(`\n✅  Teams-only run complete.\n`)
    process.exit(0)
  }

  const weeksToLoad = weeksArg
    ? WEEK_CATALOG.filter((w) => weeksArg.includes(w.weekNumber))
    : WEEK_CATALOG

  // syncSeason runs the whole catalog; we recreate per-week progress
  // output by calling it once per week so the CLI still streams. (The
  // cron route uses syncSeason whole-cloth.)
  const { syncSeason } = await import('../lib/nfl-schedule')
  let grandTotal = 0
  for (const year of years) {
    const season = `${year}-${year + 1}`
    console.log(
      `\n📅  Loading NFL ${season} schedule for ${weeksToLoad.length} week(s)\n`
    )
    let totalGames = 0
    for (const spec of weeksToLoad) {
      process.stdout.write(
        `  Week ${spec.weekNumber.toString().padStart(2)} (${spec.kind})… `
      )
      try {
        const result = await syncSeason(year, { weekNumbers: [spec.weekNumber] })
        const inserted = result.totalGames
        totalGames += inserted
        console.log(`${inserted} game${inserted === 1 ? '' : 's'} ✓`)
      } catch (err) {
        console.log(`failed`)
        console.error(`    ${err instanceof Error ? err.message : err}`)
      }
    }
    grandTotal += totalGames
    console.log(`\n   ${season}: ${totalGames} games upserted.`)
  }

  console.log(
    `\n✅  Done. ${grandTotal} games across ${years.length} season(s).\n`
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
