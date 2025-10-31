-- =====================================================
-- ASSIGN CLIENTS TO PRACTITIONER
-- Run this script AFTER Chris Voutsas has signed up
-- =====================================================

-- Step 1: Find Chris's user ID
-- Replace 'chris@example.com' with his actual email
-- Run this query first to get his user_id:

SELECT id, email, created_at
FROM auth.users
WHERE email = 'chris@example.com';  -- REPLACE WITH CHRIS'S EMAIL

-- Step 2: Copy the user ID from above and replace <CHRIS_USER_ID> below
-- Then uncomment and run these statements:

-- Assign all existing clients to Chris
-- UPDATE clients
-- SET user_id = '<CHRIS_USER_ID>'
-- WHERE user_id IS NULL;

-- Assign all existing analyses to Chris
-- UPDATE analyses
-- SET user_id = '<CHRIS_USER_ID>'
-- WHERE user_id IS NULL;

-- Assign all existing custom benchmarks to Chris
-- UPDATE custom_benchmarks
-- SET user_id = '<CHRIS_USER_ID>'
-- WHERE user_id IS NULL;

-- Assign all existing settings to Chris (if not auto-created)
-- UPDATE settings
-- SET user_id = '<CHRIS_USER_ID>'
-- WHERE user_id IS NULL;

-- Step 3: Verify the assignment worked
-- SELECT COUNT(*) as client_count FROM clients WHERE user_id = '<CHRIS_USER_ID>';
-- SELECT COUNT(*) as analysis_count FROM analyses WHERE user_id = '<CHRIS_USER_ID>';

-- =====================================================
-- USAGE INSTRUCTIONS:
-- =====================================================
-- 1. Have Chris Voutsas sign up at your app URL
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Run Step 1 query to find Chris's user_id
-- 4. Copy his user_id (looks like: 12345678-1234-1234-1234-123456789abc)
-- 5. Replace <CHRIS_USER_ID> in the UPDATE statements
-- 6. Uncomment the UPDATE statements (remove the -- at the beginning)
-- 7. Run all the UPDATE statements
-- 8. Run Step 3 verification queries to confirm
-- =====================================================
