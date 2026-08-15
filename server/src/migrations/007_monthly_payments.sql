-- SheDrive Migration 007: Monthly Platform Fee & Driver Payments
-- Creates tables and columns to track 5% monthly platform fee, payment submissions, and suspensions

-- 1. Add fee suspension column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_fee_suspended BOOLEAN DEFAULT FALSE;

-- 2. Monthly Payments Table
CREATE TABLE IF NOT EXISTS monthly_payments (
    id VARCHAR(64) PRIMARY KEY,
    driver_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- e.g., '2026-08'
    total_rides INTEGER DEFAULT 0,
    total_earnings NUMERIC(10, 2) DEFAULT 0.00,
    platform_fee NUMERIC(10, 2) DEFAULT 0.00, -- 5% of total_earnings
    due_date BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'overdue', 'rejected')),
    transaction_id VARCHAR(100),
    receipt_url TEXT,
    notes TEXT,
    admin_notes TEXT,
    submitted_at BIGINT,
    reviewed_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT unique_driver_month UNIQUE(driver_id, month_year)
);

-- Indexes for rapid lookup
CREATE INDEX IF NOT EXISTS idx_monthly_payments_driver ON monthly_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_status ON monthly_payments(status);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_month ON monthly_payments(month_year);
