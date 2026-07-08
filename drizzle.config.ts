// Drizzle Kit config — points the CLI at our schema + Neon connection.
// Migrations live under `db/migrations/` so they're co-located with the
// schema file. Use:
//   npx drizzle-kit generate    # diff schema → new migration SQL
//   npx drizzle-kit migrate     # apply pending migrations to DATABASE_URL
//   npx drizzle-kit studio      # spin up the local DB browser

import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  // Allow `drizzle-kit generate` to run without a live DB (it doesn't
  // need one); only `migrate` / `push` / `studio` will fail without it.
  console.warn('⚠️  DATABASE_URL not set in .env.local — `migrate` will fail until it is.')
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // Strict on column / table renames so we don't accidentally drop+recreate
  strict: true,
  verbose: true,
})
