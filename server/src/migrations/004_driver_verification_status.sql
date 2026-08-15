-- SheDrive SQL Migration 004: Driver Verification Status Tracking
-- Adds verification_status column to properly track driver application states
-- This fixes the issue where rejected drivers still appear in pending list

-- Add verification_status column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';

-- Create check constraint for valid values
ALTER TABLE users ADD CONSTRAINT chk_verification_status 
  CHECK (verification_status IN ('pending', 'approved', 'rejected'));

-- Update existing records based on current state
-- Drivers with is_verified = true should be 'approved'
UPDATE users SET verification_status = 'approved' WHERE is_verified = true AND role = 'driver';

-- Drivers with is_verified = false and is_active = false should be 'rejected' 
-- (assuming they were previously reviewed and rejected)
-- For now, keep others as 'pending' (new applications)
