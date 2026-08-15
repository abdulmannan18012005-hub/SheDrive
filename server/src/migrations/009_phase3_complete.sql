-- SheDrive Migration 009: Complete Phase 3 Schema Updates
-- This migration completes all Phase 3 database requirements

-- ============================================
-- 1. SAVED PLACES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS saved_places (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- 'Home', 'Work', or custom
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    UNIQUE(user_id, label) -- One Home and one Work per user
);

CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_label ON saved_places(user_id, label);

-- ============================================
-- 2. USERS TABLE - PHASE 3 UPDATES
-- ============================================

-- Add gender field
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) CHECK (gender IN ('Female', 'Other', 'Male'));

-- Add notification settings as JSON
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"rideNotifications": true, "promotionalNotifications": true, "platformNotifications": true, "paymentNotifications": true, "emergencyNotifications": true}'::jsonb;

-- Add first name and last name (if not already split)
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- Migrate existing name to first_name/last_name if new columns are empty
UPDATE users 
SET first_name = SUBSTRING(name FROM 1 FOR POSITION(' ' IN name) - 1),
    last_name = SUBSTRING(name FROM POSITION(' ' IN name) + 1)
WHERE first_name IS NULL AND last_name IS NULL AND name LIKE '% %';

-- If name doesn't have space, put everything in first_name
UPDATE users 
SET first_name = name
WHERE first_name IS NULL AND name NOT LIKE '% %';

-- ============================================
-- 3. DRIVERS TABLE - PHASE 3 UPDATES
-- ============================================

-- Add vehicle review status
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_review_status VARCHAR(20) DEFAULT 'approved' CHECK (vehicle_review_status IN ('pending', 'approved', 'rejected'));

-- Add vehicle review submission timestamp
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_review_submitted_at BIGINT;

-- Add vehicle review notes (admin comments)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_review_notes TEXT;

-- Add document expiry dates (if not already added in migration 008)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry BIGINT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS registration_expiry BIGINT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS insurance_expiry BIGINT;

-- Add profile completion percentage
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0 CHECK (profile_completion >= 0 AND profile_completion <= 100);

-- Calculate initial profile completion for existing drivers
UPDATE drivers SET profile_completion = 
    CASE 
        WHEN name IS NOT NULL THEN 10 ELSE 0 END +
    CASE 
        WHEN phone IS NOT NULL THEN 10 ELSE 0 END +
    CASE 
        WHEN photo_url IS NOT NULL THEN 10 ELSE 0 END +
    CASE 
        WHEN vehicle_make IS NOT NULL THEN 15 ELSE 0 END +
    CASE 
        WHEN vehicle_model IS NOT NULL THEN 15 ELSE 0 END +
    CASE 
        WHEN vehicle_plate IS NOT NULL THEN 15 ELSE 0 END +
    CASE 
        WHEN vehicle_color IS NOT NULL THEN 10 ELSE 0 END +
    CASE 
        WHEN license_front_url IS NOT NULL THEN 10 ELSE 0 END
WHERE profile_completion = 0;

-- ============================================
-- 4. NOTIFICATIONS TABLE - CATEGORY UPDATE
-- ============================================

-- Add new categories to the check constraint
-- Note: PostgreSQL doesn't support ALTER CONSTRAINT directly, so we recreate the table if needed
-- For existing table, we'll add a trigger or use a more flexible constraint

-- Drop existing check constraint (PostgreSQL specific)
ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_category_check;

-- Add new check constraint with updated categories
ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_category_check 
    CHECK (category IN ('system', 'ride', 'safety', 'payment', 'promotional', 'document_expiry', 'emergency'));

-- ============================================
-- 5. LOGIN ATTEMPTS TABLE (for security)
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_time BIGINT NOT NULL,
    lockout_until BIGINT,
    consecutive_lockouts INTEGER DEFAULT 0,
    device_id VARCHAR(255),
    created_at BIGINT NOT NULL,
    updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_device ON login_attempts(device_id);

-- ============================================
-- 6. SESSIONS TABLE (for session management)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    token_expiry BIGINT,
    device_id VARCHAR(255) NOT NULL,
    device_info JSONB,
    last_activity BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device ON user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active);

-- ============================================
-- 7. DOCUMENT EXPIRY TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS document_expiry_tracking (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('driving_license', 'vehicle_registration', 'insurance')),
    document_number VARCHAR(100),
    expiry_date BIGINT NOT NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_document_expiry_user ON document_expiry_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_document_expiry_type ON document_expiry_tracking(document_type);
CREATE INDEX IF NOT EXISTS idx_document_expiry_date ON document_expiry_tracking(expiry_date);

-- ============================================
-- 8. THEME PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_theme_preferences (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme_mode VARCHAR(10) DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
    font_scale DECIMAL(3, 2) DEFAULT 1.0 CHECK (font_scale >= 0.5 AND font_scale <= 2.0),
    updated_at BIGINT NOT NULL
);

-- ============================================
-- 9. CLEANUP OLD DATA (Optional)
-- ============================================

-- Remove duplicate emergency contacts if any
DELETE FROM emergency_contacts e1
WHERE id NOT IN (
    SELECT MIN(id)
    FROM emergency_contacts e2
    GROUP BY user_id, phone
);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
SELECT 'Phase 3 Migration Complete' AS status;
SELECT COUNT(*) AS saved_places_count FROM saved_places;
SELECT COUNT(*) AS login_attempts_count FROM login_attempts;
SELECT COUNT(*) AS user_sessions_count FROM user_sessions;
SELECT COUNT(*) AS document_expiry_count FROM document_expiry_tracking;
SELECT COUNT(*) AS theme_preferences_count FROM user_theme_preferences;
