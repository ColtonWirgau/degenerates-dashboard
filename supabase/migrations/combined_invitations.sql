-- Combined migration for league invitations and invite codes
-- Run this in your Supabase SQL Editor

-- ============================================
-- PART 1: League Invitations Table
-- ============================================

-- Create league_invitations table
CREATE TABLE IF NOT EXISTS league_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_invitations_token ON league_invitations(token);
CREATE INDEX IF NOT EXISTS idx_league_invitations_email ON league_invitations(email);
CREATE INDEX IF NOT EXISTS idx_league_invitations_league ON league_invitations(league_id);

-- Prevent duplicate pending invitations for same email/league (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_invitations_unique_pending
  ON league_invitations(league_id, email)
  WHERE status = 'pending';

-- Add RLS policies
ALTER TABLE league_invitations ENABLE ROW LEVEL SECURITY;

-- League members can view invitations for their league
CREATE POLICY "League members can view invitations"
  ON league_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_invitations.league_id
      AND league_members.user_id = auth.uid()
    )
  );

-- League admins and owners can create invitations
CREATE POLICY "League admins can create invitations"
  ON league_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_invitations.league_id
      AND league_members.user_id = auth.uid()
      AND league_members.role IN ('owner', 'admin')
    )
  );

-- Users can view invitations sent to their email (for signup flow)
CREATE POLICY "Users can view their own invitations"
  ON league_invitations
  FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Users can accept invitations sent to their email
CREATE POLICY "Users can accept their own invitations"
  ON league_invitations
  FOR UPDATE
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Add comments
COMMENT ON TABLE league_invitations IS 'Pending invitations for users to join leagues';
COMMENT ON COLUMN league_invitations.token IS 'Unique token for invitation link';
COMMENT ON COLUMN league_invitations.status IS 'pending, accepted, declined, or expired';
COMMENT ON COLUMN league_invitations.expires_at IS 'When the invitation expires (default 7 days)';

-- ============================================
-- PART 2: League Invite Codes
-- ============================================

-- Add invite_code column to leagues table
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code);

-- Function to generate a random 8-character invite code
CREATE OR REPLACE FUNCTION generate_league_invite_code()
RETURNS TEXT AS $$
DECLARE
  characters TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generate invite codes for existing leagues that don't have one
DO $$
DECLARE
  league_record RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR league_record IN SELECT id FROM leagues WHERE invite_code IS NULL LOOP
    LOOP
      new_code := generate_league_invite_code();
      SELECT EXISTS(SELECT 1 FROM leagues WHERE invite_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;

    UPDATE leagues SET invite_code = new_code WHERE id = league_record.id;
  END LOOP;
END $$;

-- Make invite_code NOT NULL now that all existing leagues have codes
ALTER TABLE leagues ALTER COLUMN invite_code SET NOT NULL;

-- Set default for new leagues
ALTER TABLE leagues ALTER COLUMN invite_code SET DEFAULT generate_league_invite_code();

-- Add comment
COMMENT ON COLUMN leagues.invite_code IS 'Short, shareable code for anyone to join the league (e.g., abc12345)';
