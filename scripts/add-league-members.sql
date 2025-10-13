-- Script to add league members for T-Mart's Cheatin' Ahh Parlays
-- Run this in Supabase SQL Editor

-- First, we need to insert users into auth.users (if they don't exist)
-- Note: In production, users would sign up themselves. This is for testing.

-- Since we can't directly insert into auth.users via SQL in most cases,
-- we'll use the league_id from your league. First, let's get your league ID:
-- You'll need to replace 'YOUR_LEAGUE_ID_HERE' with your actual league ID

-- Add members to the league (assuming they already have accounts or we create placeholder entries)
-- For now, let's create a simpler approach that just adds them to league_members

DO $$
DECLARE
  league_id_var UUID := '367cb29d-de7a-4b4d-948c-412cdc0a0420'; -- Replace with your actual league ID
BEGIN
  -- Note: Since we can't create auth.users directly, this will only work if these users already exist
  -- For testing purposes, you'll need to either:
  -- 1. Have them sign up normally
  -- 2. Use Supabase Dashboard to create the users manually
  -- 3. Use Supabase Admin API to create users programmatically

  -- This script assumes users exist and adds them to the league
  -- You'll need to get their user IDs after they're created

  RAISE NOTICE 'To add these members, please:';
  RAISE NOTICE '1. Have each person sign up at your app URL';
  RAISE NOTICE '2. OR use Supabase Dashboard -> Authentication -> Add User';
  RAISE NOTICE '3. OR use the invite system in your app';
END $$;

-- Alternative: Here's the data you need to add manually in Supabase Dashboard
-- Go to Authentication -> Users -> Add User

/*
MEMBERS TO ADD:
--------------
Email: joecrabb85@gmail.com
Name: Joe Crabb

Email: tylermartoia@gmail.com
Name: Tyler Martoia

Email: Zachary.conine82@gmail.com
Name: Zach Conine

Email: Baalaera@gmail.com
Name: Ashton Baalaer

Email: Hernandez.eliseo09@gmail.com
Name: Eli Hernandez

Email: Schepp13@gmail.com
Name: Andrew Schepper

Email: Skorna13@yahoo.com
Name: Steven Skorna

Email: Tjpurcell17@yahoo.com
Name: Trevor Purcell
*/
