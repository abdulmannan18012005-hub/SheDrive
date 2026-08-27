-- Migration 017: Add verified_at to user_verification_codes
-- Ensures OTP verification can be strictly distinguished from code invalidation

ALTER TABLE user_verification_codes ADD COLUMN IF NOT EXISTS verified_at BIGINT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_user_verification_codes_verified_at ON user_verification_codes(email, type, verified_at);
