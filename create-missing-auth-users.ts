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

const usersToCreate = [
  {
    email: 'schepperm21@gmail.com',
    name: 'Matt Schepper',
    password: 'IllBeUrMadisonBeer',
    userId: '29e7e280-78b8-416d-a526-1105180e9da3'
  },
  {
    email: 'denzelwright@gmail.com',
    name: 'Denzel Wright',
    password: 'DenzelWrong69#',
    userId: '9e3d956a-8ad2-4a59-8aac-32a2ffc9fc96'
  },
  {
    email: 'jdmckenna91@gmail.com',
    name: 'Josh McKenna',
    password: 'MarathonLover69!',
    userId: '209ac949-2193-486e-a0a0-fe1c0eb75e72'
  },
]

async function createMissingAuthUsers() {
  console.log('🔐 Creating missing auth users...\n')

  for (const user of usersToCreate) {
    console.log(`Creating auth user for ${user.name}...`)

    // Create the user in auth.users with the specific UUID
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: user.name
      }
    })

    if (error) {
      console.error(`❌ Failed to create ${user.name}:`, error.message)
    } else {
      console.log(`✅ Created ${user.name}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Password: ${user.password}`)
      console.log(`   New Auth ID: ${data.user?.id}`)
      console.log(`   Old Profile ID: ${user.userId}`)
      console.log(`   ⚠️  You'll need to update league_members and parlay_legs to use the new ID!\n`)
    }
  }

  console.log('✨ Done!')
}

createMissingAuthUsers().catch(console.error)
