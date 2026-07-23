-- SheDrive SQL Migration 001: Relational Schema Definition
-- Supports PostgreSQL (Supabase / Neon / Local)

-- Enable UUID Extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Riders and Driver accounts)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
    cnic VARCHAR(50),
    cnic_front_url TEXT,
    cnic_back_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Index for fast user authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Drivers Table (Vehicle & Status details)
CREATE TABLE IF NOT EXISTS drivers (
    driver_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    vehicle_category VARCHAR(20) NOT NULL DEFAULT 'mini',
    vehicle_make VARCHAR(100) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_plate VARCHAR(50) NOT NULL,
    vehicle_color VARCHAR(50) NOT NULL,
    license_number VARCHAR(100),
    license_url TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    latitude DOUBLE PRECISION DEFAULT 31.5204,
    longitude DOUBLE PRECISION DEFAULT 74.3587,
    last_location_update BIGINT NOT NULL
);

-- Index for rapid driver proximity spatial lookups
CREATE INDEX IF NOT EXISTS idx_drivers_online_available ON drivers(is_online, is_available, is_active, vehicle_category);

-- 3. Rides Table (Ride Requests, Bidding & Tracking)
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
    polyline TEXT,
    payment_method VARCHAR(20) DEFAULT 'cash',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);

-- 4. Bids Table (Negotiation history)
CREATE TABLE IF NOT EXISTS bids (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
    sender_id VARCHAR(64) NOT NULL REFERENCES users(id),
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('passenger', 'driver')),
    amount INTEGER NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bids_ride ON bids(ride_id);

-- 5. Ratings Table (Reviews & Feedback)
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
