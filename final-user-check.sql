-- Check if user_profiles exist for the new IDs
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name
FROM user_profiles
WHERE id IN (
  '5df23394-3fa8-47d9-bbac-da4322f6b01d',  -- Denzel new
  'e4abb77a-0567-42bd-90db-4c89ebfaee3e',  -- Josh new
  '094c3665-0728-424a-9a8c-2393d6d014d5'   -- Matt new
);

-- Check if old profiles still exist
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name
FROM user_profiles
WHERE id IN (
  '9e3d956a-8ad2-4a59-8aac-32a2ffc9fc96',  -- Denzel old
  '209ac949-2193-486e-a0a0-fe1c0eb75e72',  -- Josh old
  '29e7e280-78b8-416d-a526-1105180e9da3'   -- Matt old
);
