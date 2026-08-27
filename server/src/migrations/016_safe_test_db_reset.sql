-- ==============================================================================
-- SheDrive — Safe Test Database Reset Migration
-- File: server/src/migrations/016_safe_test_db_reset.sql
-- ==============================================================================
-- PURPOSE:
-- Safely removes ALL test passenger and driver accounts and their dependent
-- operational data from the Supabase/PostgreSQL database to allow clean end-to-end testing.
--
-- INTENTIONALLY PRESERVES:
-- 1. Admin accounts (users with role = 'admin')
-- 2. Platform settings table (admin_settings)
-- 3. Database schema structure, triggers, and table definitions
-- ==============================================================================

BEGIN;

-- Step 1: Remove public ride tracking share tokens
DELETE FROM ride_shares;

-- Step 2: Remove ride bidding/counter-offer records
DELETE FROM bids;

-- Step 3: Remove all ride records (active, completed, cancelled)
DELETE FROM rides;

-- Step 4: Remove driver monthly platform fee payment history
DELETE FROM monthly_payments;

-- Step 5: Remove saved home/work places for passengers/drivers
DELETE FROM saved_places;

-- Step 6: Remove active and resolved SOS emergency alerts
DELETE FROM sos_alerts;

-- Step 7: Remove in-app user notifications
DELETE FROM user_notifications;

-- Step 8: Remove passenger & driver support tickets
DELETE FROM support_tickets;

-- Step 9: Remove historical payment transaction logs
DELETE FROM payment_transactions;

-- Step 10: Remove unused and consumed email OTP verification codes
DELETE FROM user_verification_codes;

-- Step 11: Remove driver vehicle and document profiles
DELETE FROM drivers;

-- Step 12: Remove all passenger and driver user accounts (preserving admin users)
DELETE FROM users WHERE role != 'admin';

COMMIT;

-- ==============================================================================
-- VERIFICATION QUERY:
-- Execute the query below after running the script to verify that only admin accounts remain:
--
-- SELECT id, email, name, role, created_at FROM users;
-- SELECT COUNT(*) AS remaining_drivers FROM drivers;
-- SELECT COUNT(*) AS remaining_rides FROM rides;
-- ==============================================================================
