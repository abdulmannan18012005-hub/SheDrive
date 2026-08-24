-- ============================================================
-- SHEDRIVE — PHASE 10 DATABASE MIGRATION
-- Migration: 012_phase10_multistop_scheduled_payments.sql
-- Description: Supports Multi-Stop Waypoints, Scheduled Bookings, 
-- and Passenger Digital Payment Transactions (Cash, JazzCash, Easypaisa)
-- ============================================================

-- 1. Extend rides table for Scheduled Rides
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS scheduled_for BIGINT,
ADD COLUMN IF NOT EXISTS scheduled_dispatch_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_rides_scheduled 
ON rides(is_scheduled, status, scheduled_for);

-- 2. Create ride_stops table for Multi-Stop Waypoints
CREATE TABLE IF NOT EXISTS ride_stops (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    label TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at BIGINT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ride_stops_ride_order 
ON ride_stops(ride_id, stop_order);

-- 3. Create payment_transactions table for Passenger Payments
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) REFERENCES rides(ride_id) ON DELETE SET NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('cash', 'jazzcash', 'easypaisa')),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'PKR',
    transaction_ref VARCHAR(100),
    idempotency_key VARCHAR(100) UNIQUE,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'pending_user_auth', 'success', 'failed', 'refunded')),
    gateway_response JSONB,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_ride ON payment_transactions(ride_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_idempotency ON payment_transactions(idempotency_key);
