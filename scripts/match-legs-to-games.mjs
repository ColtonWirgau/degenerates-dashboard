/**
 * Reads every parlay leg and works out which game in that week it was
 * on, from the free text people typed. DRY RUN by default; pass --write
 * to persist into parlay_legs.nfl_game_id.
 *
 *   node scripts/match-legs-to-games.mjs           # report only
 *   node scripts/match-legs-to-games.mjs --write   # persist
 * Record-only legs (see below) are skipped unless --include-record-only.
 *
 * Three passes, most certain first:
 *   1. TEAM NAME  — nickname, city, full name or abbreviation ("Packers
 *      +3", "Phi -2.5", "Dal/Car O 48.5"). A leg naming two teams that
 *      play each other is the strongest signal there is.
 *   2. PLAYER NAME — matched against nfl_players, then that player's
 *      team's game that week ("Egbuka 5+ Rec", "Puka 90+ rec yards").
 *   3. UNMATCHED  — listed for a human to answer.
 *
 * Nothing is guessed. A leg that resolves to two different games, or to
 * none, comes back unmatched rather than picking one — the whole reason
 * this column exists is that the app was inventing these links.
 */
import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const WRITE = process.argv.includes('--write')
/** Opt IN to touching the record-only legs. You almost never want this. */
const INCLUDE_RECORD_ONLY = process.argv.includes('--include-record-only')

/**
 * THE RECORD-ONLY BACKFILL: three bulk inserts on 2025-10-13, the day
 * the app took over from the shared Apple Note.
 *
 * Their RESULTS are real — every win and loss was carried across from
 * the note, and 19 of the 20 per-person records reconcile exactly
 * against it across two seasons. Their DESCRIPTIONS are not: the note
 * only keeps the current week's table, so by then the old leg text was
 * gone and the backfill used placeholder samples.
 *
 * Which means matching them to a game is matching PLACEHOLDER TEXT.
 * That's how "Vikings -5" got a game seven weeks running and how three
 * bets landed on teams that were on bye. Excluded by default: a wrong
 * link here is indistinguishable from a right one once it's on screen.
 */
const SEED_FROM = '2025-10-13T16:00:00Z'
const SEED_TO = '2025-10-13T18:00:00Z'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/** Shorthand people actually type that isn't the nickname or the abbr. */
const ALIASES = {
  PHI: ['phi', 'philly', 'eagles'],
  DAL: ['dal', 'dallas', 'boys'],
  CAR: ['car', 'panthers'],
  SF: ['sf', 'niners', '49ers', 'forty niners'],
  TB: ['tb', 'bucs', 'buccaneers', 'tampa'],
  NO: ['no', 'nola', 'saints'],
  NE: ['ne', 'pats', 'patriots'],
  GB: ['gb', 'packers', 'pack'],
  KC: ['kc', 'chiefs'],
  LV: ['lv', 'raiders', 'vegas'],
  LAC: ['lac', 'chargers', 'bolts'],
  LAR: ['lar', 'la rams', 'rams'],
  NYG: ['nyg', 'giants', 'gmen', 'g men'],
  NYJ: ['nyj', 'jets'],
  WSH: ['wsh', 'was', 'washington', 'commanders'],
  JAX: ['jax', 'jags', 'jaguars'],
  ARI: ['ari', 'cards', 'cardinals'],
  BAL: ['bal', 'ravens'],
  CIN: ['cin', 'bengals'],
  CLE: ['cle', 'browns'],
  PIT: ['pit', 'steelers'],
  HOU: ['hou', 'texans'],
  IND: ['ind', 'colts'],
  TEN: ['ten', 'titans'],
  DEN: ['den', 'broncos'],
  BUF: ['buf', 'bills'],
  MIA: ['mia', 'dolphins', 'fins'],
  DET: ['det', 'lions'],
  MIN: ['min', 'vikings', 'vikes'],
  CHI: ['chi', 'bears'],
  ATL: ['atl', 'falcons'],
  SEA: ['sea', 'seahawks', 'hawks'],
}

/**
 * What people call players when they're typing a bet into their phone on
 * a Sunday. Nobody writes "Christian McCaffrey"; they write CMC. The
 * team is the season-relevant one — these are all 2025 sides, which is
 * the only season with organic legs in it.
 */
const NICKNAMES = {
  cmc: 'SF',
  arsb: 'DET',
  'amon-ra': 'DET',
  'amon ra': 'DET',
  asb: 'DET',
  dk: 'PIT',
  puka: 'LAR',
  tua: 'MIA',
  monty: 'DET',
  jt: 'IND',
  tet: 'CAR',
  bucky: 'TB',
  dak: 'DAL',
  saquon: 'PHI',
  bijan: 'ATL',
  geno: 'LV',
  achane: 'MIA',
  hurts: 'PHI',
  gibbs: 'DET',
  goff: 'DET',
  maye: 'NE',
  herbert: 'LAC',
  stafford: 'LAR',
  egbuka: 'TB',
  dart: 'NYG',
  kincaid: 'BUF',
  goedert: 'PHI',
  jefferson: 'MIN',
}

/**
 * The vocabulary of a bet, which must never be read as a surname.
 *
 * Without this, "JK Dobbins 70+ Rush/Rec Yards" matched COOPER RUSH —
 * the word "rush" is a stat and a player, and the collision quietly
 * dragged the leg to an Atlanta game. Every one of these is a real
 * surname in the league: Rush, Moore, Long, Small, Best, Steward.
 */
const STAT_WORDS = new Set([
  'rush', 'rushing', 'pass', 'passing', 'rec', 'recs', 'receiving', 'receptions',
  'catch', 'catches', 'yard', 'yards', 'yds', 'over', 'under', 'made', 'attempts',
  'sack', 'sacks', 'pick', 'picks', 'combined', 'total', 'anytime', 'first',
  'longest', 'touchdown', 'touchdowns', 'field', 'goal', 'goals', 'interception',
  'interceptions', 'completions', 'carries', 'targets', 'points', 'score', 'more',
  'least', 'plus', 'alt', 'spread', 'moneyline', 'line', 'half', 'quarter',
])

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s/+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Does `text` name this team? Word-boundary matched, so "no" inside
 *  "no bets" or "car" inside "carr" can't fire. */
function namesTeam(text, abbr, team) {
  const words = new Set(norm(text).split(/[\s/+-]+/).filter(Boolean))
  const terms = new Set([
    ...(ALIASES[abbr] ?? []),
    abbr.toLowerCase(),
    team.name.toLowerCase(),
    team.city.toLowerCase(),
  ])
  for (const t of terms) {
    if (t.includes(' ')) {
      if (norm(text).includes(t)) return true
    } else if (words.has(t)) return true
  }
  return false
}

const rows = async (sql, params) => (await pool.query(sql, params)).rows

const teams = Object.fromEntries(
  (await rows('select abbr, name, city from nfl_teams')).map((t) => [t.abbr, t])
)

// Players, longest name first so "Amon-Ra St. Brown" wins over "Brown".
const players = (
  await rows(
    "select full_name, team from nfl_players where team is not null and length(full_name) > 4"
  )
).sort((a, b) => b.full_name.length - a.full_name.length)

const legs = await rows(`
  select l.id, l.description, l.odds, l.result, l.created_at,
         w.season, w.week_number, w.id as week_id
    from parlay_legs l
    join parlays pa on pa.id = l.parlay_id
    join nfl_weeks w on w.id = pa.nfl_week_id
   order by w.season, w.week_number`)

const gamesByWeek = new Map()
for (const g of await rows(
  'select id, nfl_week_id, home_team, away_team from nfl_games'
)) {
  const arr = gamesByWeek.get(g.nfl_week_id) ?? []
  arr.push(g)
  gamesByWeek.set(g.nfl_week_id, arr)
}

const out = { team: [], player: [], ambiguous: [], none: [] }

for (const leg of legs) {
  const seeded = leg.created_at >= new Date(SEED_FROM) && leg.created_at < new Date(SEED_TO)
  if (seeded && !INCLUDE_RECORD_ONLY) continue
  const games = gamesByWeek.get(leg.week_id) ?? []
  const tag = { ...leg, seeded }

  // 1. by team
  const byTeam = games.filter(
    (g) =>
      namesTeam(leg.description, g.home_team, teams[g.home_team] ?? { name: '', city: '' }) ||
      namesTeam(leg.description, g.away_team, teams[g.away_team] ?? { name: '', city: '' })
  )
  if (byTeam.length === 1) {
    out.team.push({ ...tag, gameId: byTeam[0].id, game: `${byTeam[0].away_team} @ ${byTeam[0].home_team}` })
    continue
  }
  if (byTeam.length > 1) {
    out.ambiguous.push({ ...tag, options: byTeam.map((g) => `${g.away_team} @ ${g.home_team}`) })
    continue
  }

  // 2. by player — full name, then the nickname people actually type,
  //    then a bare surname if only one team's player answers to it.
  const text = norm(leg.description)
  let hit = players.find((pl) => text.includes(norm(pl.full_name)))

  if (!hit) {
    const nick = Object.entries(NICKNAMES).find(([k]) =>
      new RegExp(`(^|[\\s/+-])${k}([\\s/+-]|$)`).test(text)
    )
    if (nick) hit = { full_name: nick[0], team: nick[1] }
  }

  if (!hit) {
    const words = text
      .split(/[\s/+-]+/)
      .filter((w) => w.length > 3 && !STAT_WORDS.has(w))
    const surnameTeams = new Set()
    let named = null
    for (const pl of players) {
      const last = norm(pl.full_name).split(' ').pop()
      if (last.length > 3 && words.includes(last)) {
        surnameTeams.add(pl.team)
        named ??= pl
      }
    }
    // Only when the surname points at exactly one team. Two Browns on
    // two teams is a question for a person, not a coin flip.
    if (surnameTeams.size === 1) hit = named
  }

  if (hit) {
    const g = games.find((g) => g.home_team === hit.team || g.away_team === hit.team)
    if (g) {
      out.player.push({
        ...tag,
        gameId: g.id,
        game: `${g.away_team} @ ${g.home_team}`,
        via: `${hit.full_name} (${hit.team})`,
      })
      continue
    }
  }
  out.none.push(tag)
}

const n = out.team.length + out.player.length + out.ambiguous.length + out.none.length
const pct = (x) => `${((x / n) * 100).toFixed(0)}%`
console.log(
  `\n${n} legs examined${INCLUDE_RECORD_ONLY ? ' (INCLUDING record-only)' : ' (record-only legs skipped)'}\n`
)
console.log(`  matched by team name    ${String(out.team.length).padStart(4)}  ${pct(out.team.length)}`)
console.log(`  matched by player name  ${String(out.player.length).padStart(4)}  ${pct(out.player.length)}`)
console.log(`  ambiguous (2+ games)    ${String(out.ambiguous.length).padStart(4)}  ${pct(out.ambiguous.length)}`)
console.log(`  no match                ${String(out.none.length).padStart(4)}  ${pct(out.none.length)}`)

if (out.ambiguous.length) {
  console.log('\n--- AMBIGUOUS: names more than one game in the week ---')
  for (const a of out.ambiguous)
    console.log(`  ${a.season.slice(2, 4)} wk${String(a.week_number).padStart(2)} | ${a.description.padEnd(40)} | ${a.options.join('  OR  ')}`)
}
if (out.none.length) {
  console.log('\n--- NO MATCH: needs a human ---')
  for (const a of out.none)
    console.log(`  ${a.season.slice(2, 4)} wk${String(a.week_number).padStart(2)} | ${a.description}`)
}

if (WRITE) {
  let wrote = 0
  for (const m of [...out.team, ...out.player]) {
    await pool.query('update parlay_legs set nfl_game_id = $1 where id = $2', [m.gameId, m.id])
    wrote++
  }
  console.log(`\nwrote nfl_game_id on ${wrote} legs`)
} else {
  console.log('\n(dry run — pass --write to persist)')
}

await pool.end()
