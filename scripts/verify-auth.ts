// One-off check that Auth.js wrote rows after Google sign-in.
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { db } from '../db/client'
import { users, sessions, accounts } from '../db/schema'

async function main() {
  const u = await db.select().from(users)
  const s = await db.select().from(sessions)
  const a = await db.select().from(accounts)

  console.log(`users:    ${u.length}`)
  u.forEach((r) => console.log(`  ${r.id.slice(0, 8)}… · ${r.name} · ${r.email}`))
  console.log(`sessions: ${s.length}`)
  console.log(`accounts: ${a.length} (${a.map((x) => x.provider).join(', ')})`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
