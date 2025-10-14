-- League Invitations System
-- This allows inviting users by email even if they don't have an account yet

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
  accepted_at TIMESTAMPTZ,

  -- Prevent duplicate pending invitations for same email/league
  UNIQUE(league_id, email, status) WHERE status = 'pending'
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_invitations_token ON league_invitations(token);
CREATE INDEX IF NOT EXISTS idx_league_invitations_email ON league_invitations(email);
CREATE INDEX IF NOT EXISTS idx_league_invitations_league ON league_invitations(league_id);

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
