import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function queryWeek6Data() {
  // First, check if we can see ANY parlay_legs at all
  const { data: allLegs, error: allLegsError } = await supabase
    .from('parlay_legs')
    .select('id, description, leg_number')
    .limit(10)

  console.log('=== Can we see any parlay_legs? ===')
  if (allLegsError) {
    console.error('Error:', allLegsError)
  } else {
    console.log(`Found ${allLegs?.length || 0} legs (limited to 10)`)
    if (allLegs && allLegs.length > 0) {
      allLegs.forEach(leg => console.log(`  - ${leg.description}`))
    }
  }
  console.log('')

  // First, let's see what leagues exist
  const { data: leagues, error: leaguesError } = await supabase
    .from('leagues')
    .select('id, name')

  console.log('=== Available Leagues ===')
  if (leaguesError) {
    console.error('Error fetching leagues:', leaguesError)
  } else if (leagues) {
    leagues.forEach(league => {
      console.log(`  - ${league.name} (${league.id})`)
    })
  }
  console.log('')

  // Check both leagues
  const leagueIds = [
    '367cb29d-de7a-4b4d-948c-412cdc0a0420', // T-Mart's Cheatin' Ahh Parlays
    'c2f68db3-f0ba-4f6d-9724-dcaaf148d049'  // Journey to Mordor
  ]

  for (const leagueId of leagueIds) {
    const leagueName = leagues?.find(l => l.id === leagueId)?.name
    console.log(`=== Querying Data for League: ${leagueName} (${leagueId}) ===\n`)

    // Query all parlay legs for this league
    const { data: legs, error } = await supabase
      .from('parlay_legs')
      .select(`
        id,
        description,
        odds,
        result,
        leg_number,
        created_at,
        user_id,
        parlays!inner (
          id,
          league_id,
          global_week_id,
          global_weeks!inner (
            week_number
          )
        )
      `)
      .eq('parlays.league_id', leagueId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error querying legs:', error)
      continue
    }

    console.log(`Found ${legs?.length || 0} total legs`)

    if (legs && legs.length > 0) {
      // Group by week
      const byWeek = legs.reduce((acc: Record<number, any[]>, leg) => {
        const weekNum = leg.parlays?.global_weeks?.week_number
        if (weekNum) {
          if (!acc[weekNum]) acc[weekNum] = []
          acc[weekNum].push({
            week: weekNum,
            leg_number: leg.leg_number,
            description: leg.description,
            odds: leg.odds,
            result: leg.result,
            created_at: leg.created_at
          })
        }
        return acc
      }, {})

      console.log('\n=== Legs by Week ===')
      Object.keys(byWeek)
        .sort((a, b) => Number(b) - Number(a))
        .forEach(week => {
          console.log(`\nWeek ${week}: ${byWeek[Number(week)].length} legs`)
          byWeek[Number(week)].forEach(leg => {
            console.log(`  - Leg ${leg.leg_number}: ${leg.description} (${leg.odds}) [${leg.result || 'pending'}]`)
          })
        })
    }
    console.log('\n')
  }
}

queryWeek6Data()
