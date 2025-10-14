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
      invite_code,
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
    .from('league_members')
    .select(`
      id,
      user_id,
      league_id,
      role,
      joined_at,
      user:user_profiles!user_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Error fetching members:', error)
    return { members: [], error: 'Failed to load members' }
  }

  // Transform the data to flatten the user object
  const transformedMembers = members?.map(member => {
    const user = Array.isArray(member.user) ? member.user[0] : member.user
    return {
      id: member.id,
      user_id: member.user_id,
      league_id: member.league_id,
      role: member.role,
      joined_at: member.joined_at,
      email: user?.email || '',
      full_name: user?.raw_user_meta_data?.full_name || null,
      raw_user_meta_data: user?.raw_user_meta_data || null,
      avatar_url: user?.raw_user_meta_data?.avatar_url || null,
    }
  }) || []

  return { members: transformedMembers, error: null }
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

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Invalid email address' }
  }

  // Check if user exists in auth.users (via user_profiles view)
  const { data: existingUsers } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .limit(1)

  const invitedUser = existingUsers?.[0]

  // If user exists, check if already a member
  if (invitedUser) {
    const { data: existingMember } = await supabase
      .from('league_members')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', invitedUser.id)
      .single()

    if (existingMember) {
      return { success: false, error: 'User is already a member' }
    }

    // Add existing user directly to league
    const { error: insertError } = await supabase
      .from('league_members')
      .insert({
        league_id: leagueId,
        user_id: invitedUser.id,
        role: 'member',
      })

    if (insertError) {
      console.error('Error adding member:', insertError)
      return { success: false, error: 'Failed to add member' }
    }

    revalidatePath(`/leagues/${leagueId}`)
    return { success: true, error: null, message: 'Member added successfully!' }
  }

  // User doesn't exist - create an invitation
  // Check for existing pending invitation
  const { data: existingInvitation } = await supabase
    .from('league_invitations')
    .select('id, status')
    .eq('league_id', leagueId)
    .eq('email', email)
    .eq('status', 'pending')
    .single()

  if (existingInvitation) {
    return { success: false, error: 'An invitation is already pending for this email' }
  }

  // Generate unique invitation token
  const token = crypto.randomUUID()

  // Create invitation
  const { error: inviteError } = await supabase
    .from('league_invitations')
    .insert({
      league_id: leagueId,
      email: email.toLowerCase(),
      invited_by: user.id,
      token,
    })

  if (inviteError) {
    console.error('Error creating invitation:', inviteError)
    return { success: false, error: 'Failed to create invitation' }
  }

  // TODO: Send invitation email here
  // For now, we'll just return success with a message containing the invite link
  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/invite/${token}`

  revalidatePath(`/leagues/${leagueId}`)
  return {
    success: true,
    error: null,
    message: 'Invitation created! Share this link:',
    inviteUrl
  }
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

  if (!targetMember) {
    return { success: false, error: 'Member not found' }
  }

  // First, delete all parlay legs for this user in this league
  // Get all parlays for this league
  const { data: leagueParlays } = await supabase
    .from('parlays')
    .select('id')
    .eq('league_id', leagueId)

  if (leagueParlays && leagueParlays.length > 0) {
    const parlayIds = leagueParlays.map(p => p.id)

    // Delete all parlay legs for this user in these parlays
    const { error: legsDeleteError } = await supabase
      .from('parlay_legs')
      .delete()
      .in('parlay_id', parlayIds)
      .eq('user_id', targetMember.user_id)

    if (legsDeleteError) {
      console.error('Error deleting parlay legs:', legsDeleteError)
      return { success: false, error: 'Failed to remove user data' }
    }
  }

  // Now remove the member from the league
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

export async function getLeagueByInviteCode(inviteCode: string) {
  const supabase = await createClient()

  const { data: league, error } = await supabase
    .from('leagues')
    .select('id, name, invite_code, created_at')
    .eq('invite_code', inviteCode)
    .single()

  if (error || !league) {
    return { league: null, error: 'League not found' }
  }

  return { league, error: null }
}

export async function joinLeagueByInviteCode(inviteCode: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Please sign up or log in first', requiresAuth: true }
  }

  // Get league by invite code
  const { league, error: leagueError } = await getLeagueByInviteCode(inviteCode)

  if (leagueError || !league) {
    return { success: false, error: leagueError || 'League not found' }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    // Already a member, just redirect
    revalidatePath(`/leagues/${league.id}`)
    redirect(`/leagues/${league.id}`)
  }

  // Add user to league
  const { error: memberError } = await supabase
    .from('league_members')
    .insert({
      league_id: league.id,
      user_id: user.id,
      role: 'member',
    })

  if (memberError) {
    console.error('Error joining league:', memberError)
    return { success: false, error: 'Failed to join league. Please try again.' }
  }

  revalidatePath(`/leagues/${league.id}`)
  redirect(`/leagues/${league.id}`)
}

export async function regenerateInviteCode(leagueId: string) {
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
    return { success: false, error: 'Only owners and admins can regenerate invite codes' }
  }

  // Generate new code via database function
  const { data, error } = await supabase.rpc('generate_league_invite_code')

  if (error) {
    console.error('Error generating invite code:', error)
    return { success: false, error: 'Failed to generate new code' }
  }

  const newCode = data as string

  // Update league
  const { error: updateError } = await supabase
    .from('leagues')
    .update({ invite_code: newCode })
    .eq('id', leagueId)

  if (updateError) {
    console.error('Error updating invite code:', updateError)
    return { success: false, error: 'Failed to update invite code' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, inviteCode: newCode, error: null }
}
