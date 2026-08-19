-- ==============================================================================
-- SheDrive Supabase / PostgreSQL SQL Migration: Feedbacks Table
-- Attached via Foreign Key to users(id) (Driver / Passenger ID)
-- ==============================================================================

-- 1. Create feedbacks table
CREATE TABLE IF NOT EXISTS feedbacks (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    user_role VARCHAR(32) NOT NULL DEFAULT 'passenger',
    user_name VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    category VARCHAR(64) NOT NULL DEFAULT 'General Suggestion',
    comment TEXT NOT NULL,
    app_version VARCHAR(32) DEFAULT '1.0.0',
    device_info VARCHAR(255),
    status VARCHAR(32) DEFAULT 'new',
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    CONSTRAINT fk_feedbacks_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_role ON feedbacks(user_role);
CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks(category);

-- 3. Comments for database documentation
COMMENT ON TABLE feedbacks IS 'User & driver feedback submissions with foreign key linkage to users table';
COMMENT ON COLUMN feedbacks.user_id IS 'Foreign key referencing users(id) (Primary key of passenger or driver)';
COMMENT ON COLUMN feedbacks.rating IS 'User rating from 1 to 5 stars';
COMMENT ON COLUMN feedbacks.category IS 'Category: App Performance, Safety, Driver Conduct, Payment, General Suggestion';
