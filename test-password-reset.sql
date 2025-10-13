-- Let's try a simpler password first to rule out special character issues
-- Test with a simple password, then we can change it back

-- Matt Schepper - test with simple password
UPDATE auth.users
SET
  encrypted_password = crypt('TestPass123', gen_salt('bf')),
  updated_at = now()
WHERE id = '29e7e280-78b8-416d-a526-1105180e9da3';

-- Verify the update
SELECT
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  updated_at
FROM auth.users
WHERE id = '29e7e280-78b8-416d-a526-1105180e9da3';
