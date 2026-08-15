-- SheDrive SQL Migration 006: Driver Rejection Tracking
-- Allows rejected drivers to re-register after 24 hours with rejection reason display

-- Add rejection tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_timestamp BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index on rejection_timestamp for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_rejection_timestamp ON users(rejection_timestamp) WHERE rejection_timestamp IS NOT NULL;
