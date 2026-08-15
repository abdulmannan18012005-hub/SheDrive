-- SheDrive Migration 008: Phase 3 Tables (Emergency Contacts, Support Reports, Notifications, Expiries, Account Deactivation)

-- 1. Emergency Contacts Table
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);

-- 2. Support Reports Table
CREATE TABLE IF NOT EXISTS support_reports (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    user_role VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    screenshot_url TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_reports_user ON support_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_support_reports_status ON support_reports(status);

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS user_notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'system' CHECK (category IN ('system', 'ride', 'safety', 'payment', 'promotional')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(user_id, is_read);

-- 4. User Columns (Deactivation & Language)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en';

-- 5. Driver Columns (Document Expiries)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry BIGINT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS registration_expiry BIGINT;
