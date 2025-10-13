'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createLeague(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to create a league' }
  }

  const name = formData.get('name') as string

  // Validate inputs
  if (!name) {
    return { error: 'League name is required' }
  }

  if (name.length < 3) {
    return { error: 'League name must be at least 3 characters' }
  }

  // Create league (season is now tracked on weeks, not leagues)
  const { data, error } = await supabase
    .from('leagues')
    .insert({
      name,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating league:', error)
    return { error: 'Failed to create league. Please try again.' }
  }

  revalidatePath('/leagues')
  redirect(`/leagues/${data.id}`)
}

export async function getLeagues() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { leagues: [], error: null }
  }

  // Get leagues where user is a member
  const { data: leagues, error } = await supabase
    .from('leagues')
    .select(
      `
      id,
      name,
      created_at,
      league_members!inner (
        role
      )
    `
    )
    .eq('league_members.user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching leagues:', error)
    return { leagues: [], error: 'Failed to load leagues' }
  }

  return { leagues, error: null }
}

export async function getLeague(leagueId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { league: null, error: 'Unauthorized' }
  }

  // Get league with member info
  const { data: league, error } = await supabase
    .from('leagues')
    .select(
      `
      id,
      name,
      created_at,
      league_members (
        id,
        role,
        joined_at,
        user_id
      )
    `
    )
    .eq('id', leagueId)
    .single()

  if (error) {
    console.error('Error fetching league:', error)
    return { league: null, error: 'League not found' }
  }

  return { league, error: null }
}

export async function getLeagueMembers(leagueId: string) {
  const supabase = await createClient()

  const { data: members, error } = await supabase
    .from('league_members_with_users')
    .select('*')
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Error fetching members:', error)
    return { members: [], error: 'Failed to load members' }
  }

  return { members, error: null }
}

export async function getCurrentUserRole(leagueId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { role: null, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return { role: null, error: 'Failed to get user role' }
  }

  return { role: data.role, error: null }
}

export async function inviteMember(leagueId: string, email: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if current user is owner or admin
  const { role, error: roleError } = await getCurrentUserRole(leagueId)
  if (roleError || (role !== 'owner' && role !== 'admin')) {
    return { success: false, error: 'Only owners and admins can invite members' }
  }

  // Find user by email
  const { data: invitedUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (userError || !invitedUser) {
    return { success: false, error: 'User not found. They must sign up first.' }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', invitedUser.id)
    .single()

  if (existingMember) {
    return { success: false, error: 'User is already a member' }
  }

  // Add member
  const { error: insertError } = await supabase
    .from('league_members')
    .insert({
      league_id: leagueId,
      user_id: invitedUser.id,
      role: 'member',
    })

  if (insertError) {
    console.error('Error inviting member:', insertError)
    return { success: false, error: 'Failed to invite member' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

export async function updateMemberRole(
  leagueId: string,
  memberId: string,
  newRole: 'owner' | 'admin' | 'member'
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if current user is owner
  const { role, error: roleError } = await getCurrentUserRole(leagueId)
  if (roleError || role !== 'owner') {
    return { success: false, error: 'Only owners can change member roles' }
  }

  // Don't allow changing own role
  const { data: targetMember } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('id', memberId)
    .single()

  if (targetMember?.user_id === user.id) {
    return { success: false, error: "You can't change your own role" }
  }

  // Update role
  const { error: updateError } = await supabase
    .from('league_members')
    .update({ role: newRole })
    .eq('id', memberId)

  if (updateError) {
    console.error('Error updating member role:', updateError)
    return { success: false, error: 'Failed to update member role' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}

export async function removeMember(leagueId: string, memberId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if current user is owner
  const { role, error: roleError } = await getCurrentUserRole(leagueId)
  if (roleError || role !== 'owner') {
    return { success: false, error: 'Only owners can remove members' }
  }

  // Don't allow removing self
  const { data: targetMember } = await supabase
    .from('league_members')
    .select('user_id, role')
    .eq('id', memberId)
    .single()

  if (targetMember?.user_id === user.id) {
    return { success: false, error: "You can't remove yourself from the league" }
  }

  // Remove member
  const { error: deleteError } = await supabase
    .from('league_members')
    .delete()
    .eq('id', memberId)

  if (deleteError) {
    console.error('Error removing member:', deleteError)
    return { success: false, error: 'Failed to remove member' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, error: null }
}
