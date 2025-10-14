'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getInvitation(token: string) {
  const supabase = await createClient()

  const { data: invitation, error } = await supabase
    .from('league_invitations')
    .select(`
      id,
      league_id,
      email,
      status,
      expires_at,
      leagues (
        id,
        name
      )
    `)
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return { invitation: null, error: 'Invitation not found' }
  }

  // Check if invitation is expired
  const now = new Date()
  const expiresAt = new Date(invitation.expires_at)

  if (now > expiresAt) {
    return { invitation: null, error: 'This invitation has expired' }
  }

  // Check if already accepted
  if (invitation.status !== 'pending') {
    return { invitation: null, error: 'This invitation has already been used' }
  }

  return { invitation, error: null }
}

export async function acceptInvitation(token: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Store the token in a cookie so we can accept it after signup
    return { success: false, error: 'Please sign up or log in first', requiresAuth: true }
  }

  // Get invitation
  const { invitation, error: inviteError } = await getInvitation(token)

  if (inviteError || !invitation) {
    return { success: false, error: inviteError || 'Invitation not found' }
  }

  // Check if user's email matches invitation
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return {
      success: false,
      error: `This invitation was sent to ${invitation.email}. Please log in with that email address.`
    }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', invitation.league_id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    // Mark as accepted and redirect
    await supabase
      .from('league_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    revalidatePath(`/leagues/${invitation.league_id}`)
    redirect(`/leagues/${invitation.league_id}`)
  }

  // Add user to league
  const { error: memberError } = await supabase
    .from('league_members')
    .insert({
      league_id: invitation.league_id,
      user_id: user.id,
      role: 'member',
    })

  if (memberError) {
    console.error('Error adding member:', memberError)
    return { success: false, error: 'Failed to join league. Please try again.' }
  }

  // Mark invitation as accepted
  await supabase
    .from('league_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  revalidatePath(`/leagues/${invitation.league_id}`)
  redirect(`/leagues/${invitation.league_id}`)
}
