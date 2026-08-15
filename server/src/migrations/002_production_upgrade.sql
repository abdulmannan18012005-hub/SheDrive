-- SheDrive SQL Migration 002: Production Upgrades & Compliance Additions
-- Safe additive migration. Does NOT modify or delete existing tables or data.

-- 1. Extend Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS cnic_front_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cnic_back_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy_policy BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_location_consent BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_document_consent BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000;

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 2. Extend Drivers Table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cnic_front_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cnic_back_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_front_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_back_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_year VARCHAR(10) DEFAULT '2022';
ALTER TABLE drivers ALTER COLUMN rating SET DEFAULT 0.00;

-- 3. Extend Rides Table for 12-Stage Lifecycle & PIN Security
ALTER TABLE rides ADD COLUMN IF NOT EXISTS verification_pin VARCHAR(10);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_boarded_at BIGINT;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_started_at BIGINT;

-- 4. Vehicle Makes Table
CREATE TABLE IF NOT EXISTS vehicle_makes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- 5. Vehicle Models Table
CREATE TABLE IF NOT EXISTS vehicle_models (
    id SERIAL PRIMARY KEY,
    make_id INTEGER NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

-- Seed Pakistani Vehicle Makes & Models
INSERT INTO vehicle_makes (id, name) VALUES
(1, 'Suzuki'),
(2, 'Toyota'),
(3, 'Honda'),
(4, 'Hyundai'),
(5, 'Kia'),
(6, 'Changan'),
(7, 'MG'),
(8, 'DFSK'),
(9, 'Prince'),
(10, 'FAW'),
(11, 'Isuzu'),
(12, 'JAC'),
(13, 'Proton'),
(14, 'Audi'),
(15, 'BMW'),
(16, 'Mercedes'),
(17, 'Nissan'),
(18, 'Mitsubishi'),
(19, 'Others')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_models (make_id, name) VALUES
-- Suzuki
(1, 'Alto'), (1, 'Cultus'), (1, 'Wagon R'), (1, 'Swift'), (1, 'Bolan'), (1, 'Mehran'), (1, 'Every'), (1, 'Ciaz'),
-- Toyota
(2, 'Corolla'), (2, 'Yaris'), (2, 'Vitz'), (2, 'Passo'), (2, 'Fortuner'), (2, 'Hilux Revo'), (2, 'Prius'), (2, 'Aqua'),
-- Honda
(3, 'Civic'), (3, 'City'), (3, 'BR-V'), (3, 'HR-V'), (3, 'Vezel'), (3, 'N-One'), (3, 'N-Wgn'),
-- Hyundai
(4, 'Elantra'), (4, 'Tucson'), (4, 'Sonata'), (4, 'Grand Starex'), (4, 'Porter H-100'),
-- Kia
(5, 'Sportage'), (5, 'Picanto'), (5, 'Stonic'), (5, 'Sorento'), (5, 'Carnival'),
-- Changan
(6, 'Alsvin'), (6, 'Karvaan'), (6, 'Oshan X7'), (6, 'M9'),
-- MG
(7, 'HS'), (7, 'ZS'), (7, 'ZS EV'), (7, 'GT'),
-- DFSK
(8, 'Glory 580'), (8, 'K01'),
-- Prince
(9, 'Pearl'), (9, 'K07'),
-- FAW
(10, 'V2'), (10, 'X-PV'), (10, 'Carrier'),
-- Isuzu
(11, 'D-Max'),
-- JAC
(12, 'X200'), (12, 'T6'),
-- Proton
(13, 'Saga'), (13, 'X70'),
-- Audi
(14, 'A3'), (14, 'A4'), (14, 'A6'), (14, 'Q3'), (14, 'Q5'),
-- BMW
(15, '3 Series'), (15, '5 Series'), (15, 'X1'), (15, 'X3'),
-- Mercedes
(16, 'C-Class'), (16, 'E-Class'), (16, 'GLA'),
-- Nissan
(17, 'Dayz'), (17, 'Clipper'), (17, 'Sunny'), (17, 'Note'),
-- Mitsubishi
(18, 'Ek Wagon'), (18, 'Mirage'), (18, 'Lancer'), (18, 'Pajero'),
-- Others
(19, 'Custom Model / Bike / Scooty')
ON CONFLICT DO NOTHING;

-- 6. Saved Places Table
CREATE TABLE IF NOT EXISTS saved_places (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places(user_id);

-- 7. Complaints & Support Tickets Table
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

-- 8. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at BIGINT NOT NULL
);

-- 9. Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    commission_pct NUMERIC(5,2) DEFAULT 5.0,
    min_fare_floor INTEGER DEFAULT 120,
    sos_hotline VARCHAR(50) DEFAULT '+92 42 111 743 374',
    base_fare INTEGER DEFAULT 100,
    category_fares JSONB DEFAULT '[{"id":"bike","name":"Bike / Scooty","baseFare":60,"perKmRate":25},{"id":"mini","name":"SheDrive Mini","baseFare":100,"perKmRate":40},{"id":"sedan","name":"SheDrive Sedan AC","baseFare":150,"perKmRate":50},{"id":"comfort","name":"SheDrive Comfort AC","baseFare":180,"perKmRate":60},{"id":"premium","name":"SheDrive Premium","baseFare":250,"perKmRate":80},{"id":"family","name":"SheDrive Family XL","baseFare":300,"perKmRate":90}]'::jsonb,
    updated_at BIGINT NOT NULL
);

INSERT INTO admin_settings (id, commission_pct, min_fare_floor, sos_hotline, base_fare, updated_at)
VALUES (1, 5.0, 120, '+92 42 111 743 374', 100, EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Add category_fares column if table already exists from a prior migration
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS category_fares JSONB DEFAULT '[]'::jsonb;

-- 10. Audit Logs Table
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
