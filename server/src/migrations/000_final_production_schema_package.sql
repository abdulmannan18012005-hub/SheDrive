-- ============================================================================
-- SHEDRIVE PRODUCTION DATABASE SCHEMA PACKAGE
-- Complete, Clean, Production-Ready PostgreSQL Initialization Script
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: DROP ALL EXISTING TABLES (Reverse Dependency Order)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS support_reports CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS monthly_payments CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- ----------------------------------------------------------------------------
-- SECTION 2: CREATE CORE USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
    gender VARCHAR(20) DEFAULT 'Female' CHECK (gender IN ('Female', 'Other')),
    cnic VARCHAR(20),
    cnic_front_url TEXT,
    cnic_back_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(20) DEFAULT 'approved' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reset_token VARCHAR(128),
    reset_token_expires BIGINT,
    remember_me_token VARCHAR(128),
    is_active BOOLEAN DEFAULT TRUE,
    deactivation_reason TEXT,
    deactivated_at BIGINT,
    language_preference VARCHAR(10) DEFAULT 'en',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_verification ON users(verification_status);

-- ----------------------------------------------------------------------------
-- SECTION 3: CREATE DRIVERS EXTENSION TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE drivers (
    driver_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    vehicle_make VARCHAR(100) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_year VARCHAR(10) NOT NULL,
    vehicle_color VARCHAR(50) NOT NULL,
    vehicle_plate VARCHAR(50) NOT NULL,
    vehicle_photo_url TEXT,
    license_url TEXT,
    profile_photo_url TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    current_lat NUMERIC(10, 7),
    current_lng NUMERIC(10, 7),
    is_fee_suspended BOOLEAN DEFAULT FALSE,
    fee_terms_accepted BOOLEAN DEFAULT TRUE,
    fee_terms_accepted_at BIGINT,
    license_expiry BIGINT,
    registration_expiry BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX idx_drivers_plate ON drivers(vehicle_plate);
CREATE INDEX idx_drivers_online ON drivers(is_online, is_available);

-- ----------------------------------------------------------------------------
-- SECTION 4: CREATE RIDES DISPATCH TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE rides (
    id VARCHAR(64) PRIMARY KEY,
    passenger_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    pickup_name TEXT NOT NULL,
    pickup_lat NUMERIC(10, 7) NOT NULL,
    pickup_lng NUMERIC(10, 7) NOT NULL,
    dropoff_name TEXT NOT NULL,
    dropoff_lat NUMERIC(10, 7) NOT NULL,
    dropoff_lng NUMERIC(10, 7) NOT NULL,
    fare_amount NUMERIC(10, 2) NOT NULL,
    distance_km NUMERIC(8, 2),
    duration_mins INTEGER,
    vehicle_type VARCHAR(50) DEFAULT 'comfort',
    verification_pin VARCHAR(10),
    status VARCHAR(20) DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    cancelled_at BIGINT,
    cancellation_reason TEXT
);

CREATE INDEX idx_rides_passenger ON rides(passenger_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);

-- ----------------------------------------------------------------------------
-- SECTION 5: CREATE FARE BIDS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE bids (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    driver_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bid_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_bids_ride ON bids(ride_id);

-- ----------------------------------------------------------------------------
-- SECTION 6: CREATE RATINGS & REVIEWS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE ratings (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    passenger_id VARCHAR(64) NOT NULL REFERENCES users(id),
    driver_id VARCHAR(64) NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_ratings_driver ON ratings(driver_id);

-- ----------------------------------------------------------------------------
-- SECTION 7: CREATE MONTHLY PLATFORM FEE PAYMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE monthly_payments (
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

CREATE INDEX idx_monthly_payments_driver ON monthly_payments(driver_id);
CREATE INDEX idx_monthly_payments_status ON monthly_payments(status);

-- ----------------------------------------------------------------------------
-- SECTION 8: CREATE EMERGENCY CONTACTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE emergency_contacts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);

-- ----------------------------------------------------------------------------
-- SECTION 9: CREATE SUPPORT TICKETS & REPORTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);

-- ----------------------------------------------------------------------------
-- SECTION 10: CREATE USER NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE user_notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'system' CHECK (category IN ('system', 'ride', 'safety', 'payment', 'promotional')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_user_notifications_user ON user_notifications(user_id);

-- ----------------------------------------------------------------------------
-- SECTION 11: CREATE SYSTEM CONFIGURATION SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Insert Default Platform Fares and Settings
INSERT INTO system_settings (key, value, updated_at) VALUES
('commission_pct', '5.0', 1770000000000),
('sos_hotline', '"+92 42 111 743 374"', 1770000000000),
('category_fares', '[
  {"id": "bike", "name": "Bike / Scooty", "baseFare": 60, "perKmRate": 25, "perMinuteRate": 2, "minimumFare": 50},
  {"id": "mini", "name": "SheDrive Mini", "baseFare": 100, "perKmRate": 40, "perMinuteRate": 3, "minimumFare": 80},
  {"id": "sedan", "name": "SheDrive Sedan AC", "baseFare": 150, "perKmRate": 50, "perMinuteRate": 4, "minimumFare": 120},
  {"id": "comfort", "name": "SheDrive Comfort AC", "baseFare": 180, "perKmRate": 60, "perMinuteRate": 5, "minimumFare": 150},
  {"id": "premium", "name": "SheDrive Premium", "baseFare": 250, "perKmRate": 80, "perMinuteRate": 6, "minimumFare": 200},
  {"id": "family", "name": "SheDrive Family XL", "baseFare": 300, "perKmRate": 90, "perMinuteRate": 7, "minimumFare": 250}
]', 1770000000000)
ON CONFLICT (key) DO NOTHING;
