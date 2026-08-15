-- SheDrive FINAL COMPLETE DATABASE SCHEMA
-- This is the complete, production-ready schema for the entire SheDrive application
-- Run this in Supabase SQL Editor to create a fresh database

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
    cnic VARCHAR(50) NOT NULL,
    cnic_front_url TEXT,
    cnic_back_url TEXT,
    date_of_birth DATE,
    city VARCHAR(100) DEFAULT 'Lahore',
    gender VARCHAR(20) CHECK (gender IN ('Female', 'Other', 'Male')),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_blocked BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    rejection_timestamp BIGINT,
    rejection_reason TEXT,
    accepted_terms BOOLEAN DEFAULT TRUE,
    accepted_privacy_policy BOOLEAN DEFAULT TRUE,
    accepted_location_consent BOOLEAN DEFAULT TRUE,
    accepted_document_consent BOOLEAN DEFAULT TRUE,
    accepted_at BIGINT,
    deactivation_reason TEXT,
    deactivated_at BIGINT,
    language_preference VARCHAR(10) DEFAULT 'en',
    notification_settings JSONB DEFAULT '{"rideNotifications": true, "promotionalNotifications": true, "platformNotifications": true, "paymentNotifications": true, "emergencyNotifications": true}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_cnic ON users(cnic);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_users_rejection_timestamp ON users(rejection_timestamp) WHERE rejection_timestamp IS NOT NULL;

-- ============================================
-- 2. DRIVERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS drivers (
    driver_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_fee_suspended BOOLEAN DEFAULT FALSE,
    vehicle_category VARCHAR(20) NOT NULL DEFAULT 'mini',
    vehicle_make VARCHAR(100) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_plate VARCHAR(50) NOT NULL,
    vehicle_color VARCHAR(50) NOT NULL,
    vehicle_year VARCHAR(10) DEFAULT '2022',
    vehicle_photo_url TEXT,
    license_number VARCHAR(100),
    license_url TEXT,
    license_front_url TEXT,
    license_back_url TEXT,
    selfie_url TEXT,
    cnic_front_url TEXT,
    cnic_back_url TEXT,
    license_expiry BIGINT,
    registration_expiry BIGINT,
    insurance_expiry BIGINT,
    vehicle_review_status VARCHAR(20) DEFAULT 'approved' CHECK (vehicle_review_status IN ('pending', 'approved', 'rejected')),
    vehicle_review_submitted_at BIGINT,
    vehicle_review_notes TEXT,
    profile_completion INTEGER DEFAULT 0 CHECK (profile_completion >= 0 AND profile_completion <= 100),
    rating NUMERIC(3, 2) DEFAULT 0.00,
    total_rides INTEGER DEFAULT 0,
    fee_terms_accepted BOOLEAN DEFAULT FALSE,
    fee_terms_accepted_at BIGINT,
    latitude DOUBLE PRECISION DEFAULT 31.5204,
    longitude DOUBLE PRECISION DEFAULT 74.3587,
    last_location_update BIGINT NOT NULL
);

-- Indexes for drivers
CREATE INDEX IF NOT EXISTS idx_drivers_online_available ON drivers(is_online, is_available, is_active, vehicle_category);
CREATE INDEX IF NOT EXISTS idx_drivers_vehicle_plate ON drivers(UPPER(vehicle_plate));
CREATE INDEX IF NOT EXISTS idx_drivers_fee_suspended ON drivers(is_fee_suspended);

-- ============================================
-- 3. RIDES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rides (
    ride_id VARCHAR(64) PRIMARY KEY,
    passenger_id VARCHAR(64) NOT NULL REFERENCES users(id),
    driver_id VARCHAR(64) REFERENCES users(id),
    status VARCHAR(30) NOT NULL CHECK (status IN ('requested', 'negotiating', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
    vehicle_category VARCHAR(20) NOT NULL DEFAULT 'mini',
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    pickup_label TEXT NOT NULL,
    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,
    dropoff_label TEXT NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL,
    duration_min INTEGER NOT NULL,
    estimated_fare INTEGER NOT NULL,
    offered_fare INTEGER NOT NULL,
    final_fare INTEGER,
    verification_pin VARCHAR(10),
    passenger_boarded_at BIGINT,
    ride_started_at BIGINT,
    polyline TEXT,
    payment_method VARCHAR(20) DEFAULT 'cash',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Indexes for rides
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at);

-- ============================================
-- 4. BIDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bids (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
    sender_id VARCHAR(64) NOT NULL REFERENCES users(id),
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('passenger', 'driver')),
    amount INTEGER NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bids_ride ON bids(ride_id);

-- ============================================
-- 5. RATINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ratings (
    rating_id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(ride_id),
    from_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    to_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_ride ON ratings(ride_id);

-- ============================================
-- 6. VEHICLE MAKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_makes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- ============================================
-- 7. VEHICLE MODELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_models (
    id SERIAL PRIMARY KEY,
    make_id INTEGER NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

-- ============================================
-- 8. SAVED PLACES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS saved_places (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    UNIQUE(user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_label ON saved_places(user_id, label);

-- ============================================
-- 9. COMPLAINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) REFERENCES rides(ride_id) ON DELETE SET NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);

-- ============================================
-- 10. SUPPORT TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);

-- ============================================
-- 11. ADMIN SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    commission_pct NUMERIC(5,2) DEFAULT 5.0,
    sos_hotline VARCHAR(50) DEFAULT '+92 42 111 743 374',
    category_fares JSONB DEFAULT '[]'::jsonb,
    updated_at BIGINT NOT NULL
);

-- ============================================
-- 12. AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- 13. EMERGENCY CONTACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);

-- ============================================
-- 14. SUPPORT REPORTS TABLE
-- ============================================
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

-- ============================================
-- 15. USER NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'system' CHECK (category IN ('system', 'ride', 'safety', 'payment', 'promotional', 'document_expiry', 'emergency')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(user_id, is_read);

-- ============================================
-- 16. LOGIN ATTEMPTS TABLE
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
-- 17. USER SESSIONS TABLE
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
-- 18. DOCUMENT EXPIRY TRACKING TABLE
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
-- 19. USER THEME PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_theme_preferences (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme_mode VARCHAR(10) DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
    font_scale DECIMAL(3, 2) DEFAULT 1.0 CHECK (font_scale >= 0.5 AND font_scale <= 2.0),
    updated_at BIGINT NOT NULL
);

-- ============================================
-- 20. MONTHLY PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_payments (
    id VARCHAR(64) PRIMARY KEY,
    driver_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL,
    total_rides INTEGER DEFAULT 0,
    total_earnings NUMERIC(10, 2) DEFAULT 0.00,
    platform_fee NUMERIC(10, 2) DEFAULT 0.00,
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

CREATE INDEX IF NOT EXISTS idx_monthly_payments_driver ON monthly_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_status ON monthly_payments(status);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_month ON monthly_payments(month_year);

-- ============================================
-- SCHEMA CREATION COMPLETE
-- ============================================
SELECT 'SheDrive Complete Schema Created Successfully' AS status;
