// Drizzle database client. Single source of truth for queries —
// import `db` everywhere we read/write to Neon.
//
// Uses the standard `pg` Pool driver (works in dev + Vercel serverless
// + Vercel Fluid). If/when we need lower cold-start times in production,
// swap to `@neondatabase/serverless` + `drizzle-orm/neon-http` — same
// query API, different transport.

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local.')
}

// Use globalThis so the pool survives Next.js hot-reload in dev — without
// this we leak connections every time a server file changes.
const globalForDb = globalThis as unknown as { pool?: Pool }

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export type DB = typeof db
