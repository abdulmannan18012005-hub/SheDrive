-- Clear Old Users Data Migration
-- This migration deletes old user data WITHOUT changing any schema, table structure, or columns
-- Run this in Supabase SQL Editor or via your database management tool

-- IMPORTANT: This will permanently delete data. Review before running!

-- Delete old passengers (created more than 30 days ago, not admin)
-- Adjust the date threshold as needed
DELETE FROM users 
WHERE role = 'passenger' 
  AND created_at < (NOW() - INTERVAL '30 days')
  AND id NOT IN (SELECT DISTINCT passenger_id FROM rides WHERE status = 'completed');

-- Delete old drivers (created more than 30 days ago, not admin, no completed rides)
DELETE FROM users 
WHERE role = 'driver' 
  AND created_at < (NOW() - INTERVAL '30 days')
  AND id NOT IN (SELECT DISTINCT driver_id FROM rides WHERE status = 'completed')
  AND id NOT IN (SELECT DISTINCT driver_id FROM rides WHERE status IN ('requested', 'negotiating', 'accepted', 'arrived', 'in_progress'));

-- Delete orphaned driver records (no corresponding user)
DELETE FROM drivers 
WHERE driver_id NOT IN (SELECT id FROM users WHERE role = 'driver');

-- Delete old rides (completed more than 90 days ago)
-- Adjust the date threshold as needed
DELETE FROM rides 
WHERE status = 'completed' 
  AND completed_at < (NOW() - INTERVAL '90 days');

-- Delete old support reports (resolved more than 60 days ago)
DELETE FROM support_reports 
WHERE status = 'resolved' 
  AND resolved_at < (NOW() - INTERVAL '60 days');

-- Delete old notification history (more than 30 days old)
DELETE FROM user_notifications 
WHERE created_at < (NOW() - INTERVAL '30 days');

-- VACUUM to reclaim disk space
VACUUM;

-- NOTE: This migration does NOT:
-- - Change any table structure
-- - Add or remove columns
-- - Change data types
-- - Modify indexes or constraints
-- - Affect admin accounts
-- - Delete active rides or recent users

-- SAFETY CHECK: Run this query first to see what will be deleted:
-- SELECT COUNT(*) FROM users WHERE role = 'passenger' AND created_at < (NOW() - INTERVAL '30 days');
-- SELECT COUNT(*) FROM users WHERE role = 'driver' AND created_at < (NOW() - INTERVAL '30 days');
