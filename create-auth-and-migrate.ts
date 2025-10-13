import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const users = [
  {
    email: 'schepperm21@gmail.com',
    name: 'Matt Schepper',
    password: 'IllBeUrMadisonBeer',
    oldId: '29e7e280-78b8-416d-a526-1105180e9da3',
  },
  {
    email: 'denzelwright@gmail.com',
    name: 'Denzel Wright',
    password: 'DenzelWrong69#',
    oldId: '9e3d956a-8ad2-4a59-8aac-32a2ffc9fc96',
  },
  {
    email: 'jdmckenna91@gmail.com',
    name: 'Josh McKenna',
    password: 'MarathonLover69!',
    oldId: '209ac949-2193-486e-a0a0-fe1c0eb75e72',
  },
]

async function createAuthAndMigrate() {
  console.log('🔐 Creating auth users and migrating data...\n')

  for (const user of users) {
    console.log(`\n📝 Processing ${user.name}...`)

    // Step 1: Create auth user (no email will be sent because email_confirm: true)
    console.log(`   Creating auth account...`)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm, no email sent
      user_metadata: {
        full_name: user.name
      }
    })

    if (authError) {
      console.error(`   ❌ Failed to create auth:`, authError.message)
      continue
    }

    const newId = authData.user?.id
    if (!newId) {
      console.error(`   ❌ No user ID returned`)
      continue
    }

    console.log(`   ✅ Created auth user`)
    console.log(`   Old ID: ${user.oldId}`)
    console.log(`   New ID: ${newId}`)

    // Step 2: Migrate parlay_legs
    const { data: legs, error: legsError } = await supabase
      .from('parlay_legs')
      .update({ user_id: newId })
      .eq('user_id', user.oldId)
      .select()

    if (legsError) {
      console.error(`   ❌ Error updating parlay_legs:`, legsError.message)
    } else {
      console.log(`   ✅ Migrated ${legs?.length || 0} parlay legs`)
    }

    // Step 3: Migrate league_members
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .update({ user_id: newId })
      .eq('user_id', user.oldId)
      .select()

    if (membersError) {
      console.error(`   ❌ Error updating league_members:`, membersError.message)
    } else {
      console.log(`   ✅ Migrated ${members?.length || 0} league memberships`)
    }

    // Step 4: Delete old user_profile
    const { error: deleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.oldId)

    if (deleteError) {
      console.error(`   ❌ Error deleting old profile:`, deleteError.message)
    } else {
      console.log(`   ✅ Deleted old profile`)
    }

    console.log(`   🎉 ${user.name} complete!`)
    console.log(`   Login: ${user.email} / ${user.password}`)
  }

  console.log('\n✨ All done! No emails were sent.')
}

createAuthAndMigrate().catch(console.error)
