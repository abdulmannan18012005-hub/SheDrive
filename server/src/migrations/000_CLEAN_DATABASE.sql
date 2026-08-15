-- SheDrive CLEAN DATABASE SCRIPT
-- This script safely removes all SheDrive data and tables in the correct dependency order
-- Run this before the complete schema migration to start fresh

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- ============================================
-- DROP TABLES IN CORRECT DEPENDENCY ORDER
-- ============================================

-- Drop child tables first (those with foreign keys)
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS document_expiry_tracking CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS monthly_payments CASCADE;
DROP TABLE IF EXISTS saved_places CASCADE;
DROP TABLE IF EXISTS support_reports CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_theme_preferences CASCADE;
DROP TABLE IF EXISTS vehicle_models CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Drop parent tables
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS vehicle_makes CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;

-- Drop users table last (it's referenced by many tables)
DROP TABLE IF EXISTS users CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- ============================================
-- CLEANUP COMPLETE
-- ============================================
SELECT 'SheDrive Database Cleaned Successfully' AS status;
SELECT 'All tables dropped. Ready for fresh schema migration.' AS message;
