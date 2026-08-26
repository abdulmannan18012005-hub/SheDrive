-- ==============================================================================
-- SheDrive Phase 17: User Verification Codes & Integrity Constraints Migration
-- Migration: 014_phase17_verification_codes_and_integrity.sql
-- Description: Creates user_verification_codes table for persistent, one-time OTP
--              and password reset tokens. Adds non-destructive data integrity constraints.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS user_verification_codes (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'registration' or 'password_reset'
    expires_at BIGINT NOT NULL,
    last_sent_at BIGINT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email_type ON user_verification_codes (email, type);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code_type_used ON user_verification_codes (code, type, used);

-- Enable RLS for user_verification_codes
ALTER TABLE IF EXISTS user_verification_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        DROP POLICY IF EXISTS service_role_all_verification ON public.user_verification_codes;
        CREATE POLICY service_role_all_verification ON public.user_verification_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        DROP POLICY IF EXISTS postgres_all_verification ON public.user_verification_codes;
        CREATE POLICY postgres_all_verification ON public.user_verification_codes FOR ALL TO postgres USING (true) WITH CHECK (true);
    END IF;
END $$;
