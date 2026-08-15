-- SheDrive SQL Migration 003: Registration Flow Changes
-- Adds date_of_birth for drivers, removes CNIC URL requirements for passengers
-- Safe additive migration - does not delete existing data

-- 1. Add date_of_birth column to users table (for driver age validation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 2. Add is_blocked column to users table if not exists (for admin blocking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- 3. Add vehicle_year to drivers table if not exists (already exists in migration 002, but ensuring it's there)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_year VARCHAR(10) DEFAULT '2022';

-- Note: CNIC URL columns (cnic_front_url, cnic_back_url) are kept in the database
-- for backward compatibility, but will no longer be required for new registrations
-- Passengers will only provide CNIC number (text field)
-- Drivers will provide CNIC number (text field) + DOB + License photos + Photo
