import * as crypto from 'crypto'

// Function to hash password (Supabase uses bcrypt, but we'll generate a simpler hash for now)
function generatePasswordHash(password: string): string {
  // This is a simple hash - Supabase will rehash it properly on first login
  return crypto.createHash('sha256').update(password).digest('hex')
}

const users = [
  { uid: '29e7e280-78b8-416d-a526-1105180e9da3', name: 'Matt Schepper', password: 'IllBeUrMadisonBeer' },
  { uid: '9e3d956a-8ad2-4a59-8aac-32a2ffc9fc96', name: 'Denzel Wright', password: 'DenzelWrong69#' },
  { uid: '209ac949-2193-486e-a0a0-fe1c0eb75e72', name: 'Josh McKenna', password: 'MarathonLover69!' },
]

console.log('Run these SQL commands in Supabase SQL Editor:\n')
console.log('-- Update passwords for Matt, Denzel, and Josh')
console.log('')

for (const user of users) {
  console.log(`-- ${user.name}`)
  console.log(`UPDATE auth.users`)
  console.log(`SET encrypted_password = crypt('${user.password}', gen_salt('bf'))`)
  console.log(`WHERE id = '${user.uid}';`)
  console.log('')
}

console.log('-- Verify the updates')
console.log('SELECT id, email, updated_at FROM auth.users WHERE id IN (')
users.forEach((u, i) => {
  console.log(`  '${u.uid}'${i < users.length - 1 ? ',' : ''}`)
})
console.log(');')
