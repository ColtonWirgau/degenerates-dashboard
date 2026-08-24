// Side-effect module: load .env.local BEFORE any module that reads env at
// import time (db/client throws without DATABASE_URL). ESM hoists imports
// above top-level code, so `config()` inline in a script runs too late —
// import this first instead.
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local'), quiet: true })
