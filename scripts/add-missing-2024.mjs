/**
 * The three people the 2024 import left out.
 *
 *   node scripts/add-missing-2024.mjs           # report
 *   node scripts/add-missing-2024.mjs --write   # add them
 *
 * The league's shared note carries an all-time column. Subtract the
 * 2025 season line from it and what's left is 2024 — and it says Denzel
 * went 3-2, Josh 3-4 and Matt 4-3 that year. The import that seeded 2024
 * covered eight of the eleven who played and skipped those three
 * entirely, so the 2024 board has been wrong for them ever since.
 *
 * These go in as record_only, exactly like the other 107: the result is
 * the real part and the wording never existed.
 *
 * WHICH WEEK EACH ONE LANDS IN IS NOT KNOWN, and can't be. The note
 * keeps totals, not a history — that's true of the eight already in
 * there too, whose week-by-week placement was invented by the same
 * import. Only the season totals are load-bearing. Results are dealt
 * alternating rather than blocked so the board doesn't imply a streak
 * nobody can vouch for.
 */
import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
const WRITE = process.argv.includes('--write')

/** From the note: all-time minus the 2025 season line. */
const OWED = [
  { email: 'dwright584@gmail.com', name: 'Denzel', wins: 3, losses: 2 },
  { email: 'jdmckenna91@gmail.com', name: 'Josh', wins: 3, losses: 4 },
  { email: 'schepperm21@gmail.com', name: 'Matt', wins: 4, losses: 3 },
]

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const rows = async (sql, params) => (await pool.query(sql, params)).rows

// The weeks 2024 actually has parlays for, in order.
const weeks = await rows(`
  select pa.id as parlay_id, w.week_number
    from parlays pa
    join nfl_weeks w on w.id = pa.nfl_week_id
   where w.season = '2024-2025'
   order by w.week_number`)

let planned = 0
const plan = []
for (const person of OWED) {
  const [user] = await rows('select id, name from users where email = $1', [person.email])
  if (!user) {
    console.log(`  !! no user for ${person.email} — skipped`)
    continue
  }
  const existing = await rows(
    `select count(*)::int n from parlay_legs l
       join parlays pa on pa.id = l.parlay_id
       join nfl_weeks w on w.id = pa.nfl_week_id
      where w.season = '2024-2025' and l.user_id = $1`,
    [user.id]
  )
  if (existing[0].n > 0) {
    console.log(`  ${person.name}: already has ${existing[0].n} legs in 2024 — skipped`)
    continue
  }

  // Alternate W/L, then whatever's left, so no invented streaks.
  const results = []
  let { wins, losses } = person
  while (wins > 0 || losses > 0) {
    if (wins > 0) { results.push('win'); wins-- }
    if (losses > 0) { results.push('loss'); losses-- }
  }
  results.forEach((result, i) => {
    const w = weeks[i]
    if (!w) return
    plan.push({ userId: user.id, name: person.name, week: w.week_number, parlayId: w.parlay_id, result })
  })
  planned += results.length
  console.log(
    `  ${person.name}: ${person.wins}-${person.losses} → ${results.length} legs, weeks ${weeks
      .slice(0, results.length)
      .map((w) => w.week_number)
      .join(', ')}`
  )
}

console.log(`\n${planned} legs to add`)
if (!WRITE) {
  console.log('(dry run — pass --write to add them)')
  await pool.end()
  process.exit(0)
}

for (const r of plan) {
  await pool.query(
    `insert into parlay_legs
       (parlay_id, user_id, leg_number, description, odds, result,
        record_only, locked_at, created_at, updated_at)
     values ($1,$2,0,'Unknown leg',-110,$3,true,now(),now(),now())
     on conflict (parlay_id, user_id) do nothing`,
    [r.parlayId, r.userId, r.result]
  )
}
console.log(`added ${plan.length} legs`)
await pool.end()
