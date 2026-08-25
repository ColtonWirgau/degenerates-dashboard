/**
 * Pull Sleeper's NFL catalog into `nfl_players`.
 *
 *   npx tsx scripts/sync-nfl-players.mts
 *
 * Safe to re-run — it upserts. Worth running whenever rosters move; a
 * stale row is a wrong team abbreviation beside a right name.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const { syncNflPlayers } = await import('../lib/nfl-players')
const out = await syncNflPlayers()
console.log(`Sleeper returned ${out.fetched} players; kept ${out.kept} active ones.`)
process.exit(0)
