-- ==============================================================================
-- SheDrive — Production-Safe Database Test Data Purge Migration
-- File: server/src/migrations/019_clean_test_data.sql
-- ==============================================================================
-- PURPOSE:
-- Safely purges all temporary/test operational records (rides, drivers, passengers,
-- bids, ratings, emergency contacts, saved places, OTP codes, tickets, notifications)
-- while 100% preserving:
-- 1. Database schema, table structures, and constraints
-- 2. Performance and spatial indexes
-- 3. System admin settings (admin_settings)
-- 4. Vehicle makes and models reference tables (vehicle_makes, vehicle_models)
-- 5. Master Administrator accounts (users with role = 'admin')
-- ==============================================================================

BEGIN;

-- 1. Operational Ride & Dispatch Data
DELETE FROM ride_shares;
DELETE FROM ratings;
DELETE FROM complaints;
DELETE FROM bids;
DELETE FROM rides;

-- 2. Financial & Payment Records
DELETE FROM payment_transactions;
DELETE FROM monthly_payments;

-- 3. Safety & Emergency Tracking
DELETE FROM sos_alerts;
DELETE FROM emergency_contacts;

-- 4. User Places & Support Ecosystem
DELETE FROM saved_places;
DELETE FROM support_reports;
DELETE FROM support_tickets;
DELETE FROM feedbacks;

-- 5. Notifications, Sessions & Auth Cache
DELETE FROM user_notifications;
DELETE FROM user_verification_codes;
DELETE FROM document_expiry_tracking;
DELETE FROM login_attempts;
DELETE FROM user_sessions;

-- 6. Driver Profiles (Cascade references)
DELETE FROM drivers;

-- 7. Audit Trail: Purge testing user logs while keeping admin configuration history
DELETE FROM audit_logs WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'admin');

-- 8. Users Roster: Delete all test passengers and test drivers, preserving Master Admin
DELETE FROM users WHERE role != 'admin';

COMMIT;

-- ==============================================================================
-- VERIFICATION CHECK:
-- Run to confirm database state:
-- SELECT id, email, name, role, created_at FROM users;
-- SELECT COUNT(*) AS remaining_passengers FROM users WHERE role = 'passenger';
-- SELECT COUNT(*) AS remaining_drivers FROM drivers;
-- SELECT COUNT(*) AS remaining_rides FROM rides;
-- ==============================================================================
