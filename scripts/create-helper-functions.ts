import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createHelperFunctions() {
  console.log('Creating helper function get_current_global_week...')

  const sql = `
CREATE OR REPLACE FUNCTION get_current_global_week(p_season TEXT DEFAULT '2025-2026')
RETURNS TABLE (
  id UUID,
  week_number INTEGER,
  season TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT gw.id, gw.week_number, gw.season, gw.start_date, gw.end_date
  FROM global_weeks gw
  WHERE gw.season = p_season
    AND now() >= gw.start_date
    AND now() <= gw.end_date
  ORDER BY gw.week_number DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
  `.trim()

  const { error } = await supabase.rpc('exec_sql', { query: sql })

  if (error) {
    console.error('Error creating function:', error)
    console.log('Note: This requires elevated permissions. You may need to run this SQL manually in Supabase dashboard:')
    console.log('\n' + sql + '\n')
  } else {
    console.log('✓ Helper function created successfully!')
  }
}

createHelperFunctions()
