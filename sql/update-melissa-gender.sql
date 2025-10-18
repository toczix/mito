-- ============================================
-- Quick Fix: Update Melissa's Gender to Female
-- ============================================
-- This script will update any client named "Melissa" to have gender = 'female'
-- Run this in your Supabase SQL Editor
-- ============================================

-- First, let's see which clients might be Melissa (for verification)
SELECT 
  id,
  full_name,
  gender,
  date_of_birth,
  status
FROM clients
WHERE full_name ILIKE '%melissa%'
ORDER BY full_name;

-- ============================================
-- UPDATE: Change Melissa's gender to female
-- ============================================
-- Uncomment the UPDATE statement below AFTER verifying the SELECT results above
-- Make sure to replace 'Melissa [LastName]' with the exact name from your database

-- UPDATE clients
-- SET 
--   gender = 'female',
--   updated_at = NOW()
-- WHERE full_name ILIKE '%melissa%';

-- ============================================
-- Alternative: Update by specific ID
-- ============================================
-- If you know Melissa's client ID, use this instead (more precise):

-- UPDATE clients
-- SET 
--   gender = 'female',
--   updated_at = NOW()
-- WHERE id = 'YOUR-CLIENT-ID-HERE';

-- ============================================
-- Verify the update
-- ============================================
-- Run this after the UPDATE to confirm it worked:

-- SELECT 
--   id,
--   full_name,
--   gender,
--   date_of_birth,
--   updated_at
-- FROM clients
-- WHERE full_name ILIKE '%melissa%';

