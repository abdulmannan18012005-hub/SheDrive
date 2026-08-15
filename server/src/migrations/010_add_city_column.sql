-- SheDrive Migration 010: Add City Column to Users Table
-- This migration adds a city column to the users table for registration

-- Add city column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Lahore';

-- Update existing users to have Lahore as default city
UPDATE users SET city = 'Lahore' WHERE city IS NULL;

-- Add index on city for faster queries
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

-- Verify migration
SELECT 'City column migration complete' AS status;
SELECT COUNT(*) AS users_without_city FROM users WHERE city IS NULL;
