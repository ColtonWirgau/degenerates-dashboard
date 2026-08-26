/**
 * Puts back the legs that didn't survive the Supabase → Neon migration.
 *
 *   node scripts/restore-lost-legs.mjs           # report
 *   node scripts/restore-lost-legs.mjs --write   # restore
 *
 * Twenty-five legs are in the backup and not in Neon. Ten belong to
 * "Journey to Mordor", a second league dropped on purpose when the app
 * went single-tenant — those stay gone. Fifteen belong to THIS league
 * and all fifteen are Joe Crabb's: his entire 2025 season vanished, so
 * he shows 0-0 on a board where everyone else has fifteen or sixteen
 * legs.
 *
 * All fifteen come back, but not as the same kind of row. Eleven were
 * typed by him week by week and keep their wording. Four belong to the
 * 2025-10-13 import, whose results are real (the league's note has him
 * 2-2 through week 5) and whose text never existed — those land as
 * record_only, reading "Unknown leg", exactly like the other 107.
 */
import { Pool } from 'pg'
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config({ path: '.env.local', quiet: true })

const WRITE = process.argv.includes('--write')
const SNAP = JSON.parse(
  readFileSync('lib/data/fixtures/real-snapshot/parlay_legs.json', 'utf8')
)
const LIB = new Set(
  [...readFileSync('lib/data/leg-library.ts', 'utf8').matchAll(/description:\s*'([^']+)'/g)].map(
    (m) => m[1]
  )
)
const seeded = (l) => l.created_at >= '2025-10-13T16:00' && l.created_at < '2025-10-13T18:00'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const rows = async (sql, params) => (await pool.query(sql, params)).rows

const have = new Set((await rows('select id from parlay_legs')).map((r) => r.id))
const slots = new Set(
  (await rows('select parlay_id, user_id from parlay_legs')).map((r) => `${r.parlay_id}|${r.user_id}`)
)
const parlays = new Set((await rows('select id from parlays')).map((r) => r.id))
const users = Object.fromEntries(
  (await rows('select id, name, email from users')).map((r) => [r.id, r.name ?? r.email])
)
const weekOf = Object.fromEntries(
  (
    await rows(
      'select pa.id, w.season, w.week_number from parlays pa join nfl_weeks w on w.id = pa.nfl_week_id'
    )
  ).map((r) => [r.id, `${r.season.slice(2, 4)} wk${r.week_number}`])
)

// Restorable: missing, this league's parlay still exists, the person is
// still here, the slot is free, and it isn't seeded.
const candidates = SNAP.filter(
  (l) =>
    !have.has(l.id) &&
    parlays.has(l.parlay_id) &&
    users[l.user_id] &&
    !slots.has(`${l.parlay_id}|${l.user_id}`)
)
const skippedOtherLeague = SNAP.filter((l) => !have.has(l.id) && !parlays.has(l.parlay_id))

console.log(`\nrestorable: ${candidates.length}`)
for (const l of candidates)
  console.log(
    `  ${(weekOf[l.parlay_id] ?? '?').padEnd(9)} ${users[l.user_id].padEnd(14)} | ${l.description} | ${l.odds} | ${l.result ?? 'ungraded'}`
  )
console.log(
  `  ${candidates.filter(seeded).length} of these are record-only (real result, text never kept)`
)
console.log(`skipped, belongs to another league: ${skippedOtherLeague.length}`)
// A restorable leg CAN appear in leg-library without being fake: that
// file's own header says its samples were "drawn from the live data
// snapshot", so the copying went real → library. Joe's real "Josh
// Jacobs ATD" is in there for exactly that reason. What actually marks
// the seeded legs is the timestamp — three bulk inserts inside one hour
// — not the wording.
const collisions = candidates.filter((l) => LIB.has(l.description))
const days = new Set(candidates.map((l) => l.created_at.slice(0, 10)))
console.log(
  `  ${collisions.length} of these also appear in leg-library (expected: it was built from real bets)`
)
console.log(`  spread across ${days.size} separate days → submitted one at a time, not seeded`)

if (!WRITE) {
  console.log('\n(dry run — pass --write to restore)')
  await pool.end()
  process.exit(0)
}

let n = 0
for (const l of candidates) {
  await pool.query(
    `insert into parlay_legs
       (id, parlay_id, user_id, leg_number, description, odds, result,
        validation_status, validation_message, locked_at, created_at, updated_at,
        record_only)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     on conflict (id) do nothing`,
    [
      l.id,
      l.parlay_id,
      l.user_id,
      l.leg_number ?? 0,
      seeded(l) ? 'Unknown leg' : l.description,
      l.odds,
      l.result,
      l.validation_status === 'approved' ? 'approved' : null,
      l.validation_message,
      l.submitted_at ?? l.created_at,
      l.created_at,
      l.updated_at ?? l.created_at,
      seeded(l),
    ]
  )
  n++
}
console.log(`\nrestored ${n} legs`)
await pool.end()
