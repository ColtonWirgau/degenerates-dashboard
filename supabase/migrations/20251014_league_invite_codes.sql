-- Add invite codes to leagues for easy sharing
-- This allows a league to have a permanent, shareable invite link

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
