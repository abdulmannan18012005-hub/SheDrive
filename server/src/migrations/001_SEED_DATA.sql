-- SheDrive SEED DATA SCRIPT
-- This script inserts essential default data for the SheDrive application
-- Run this after the complete schema migration

-- ============================================
-- 1. ADMIN SETTINGS
-- ============================================
INSERT INTO admin_settings (id, commission_pct, sos_hotline, category_fares, updated_at)
VALUES (
    1,
    5.0,
    '+92 42 111 743 374',
    '[
        {"id":"bike","name":"Bike / Scooty","baseFare":60,"perKmRate":25,"perMinuteRate":2,"minimumFare":50},
        {"id":"mini","name":"SheDrive Mini","baseFare":100,"perKmRate":40,"perMinuteRate":3,"minimumFare":80},
        {"id":"sedan","name":"SheDrive Sedan AC","baseFare":150,"perKmRate":50,"perMinuteRate":4,"minimumFare":120},
        {"id":"comfort","name":"SheDrive Comfort AC","baseFare":180,"perKmRate":60,"perMinuteRate":5,"minimumFare":150},
        {"id":"premium","name":"SheDrive Premium","baseFare":250,"perKmRate":80,"perMinuteRate":6,"minimumFare":200},
        {"id":"family","name":"SheDrive Family XL","baseFare":300,"perKmRate":90,"perMinuteRate":7,"minimumFare":250}
    ]'::jsonb,
    EXTRACT(EPOCH FROM NOW()) * 1000
)
ON CONFLICT (id) DO UPDATE SET
    commission_pct = EXCLUDED.commission_pct,
    sos_hotline = EXCLUDED.sos_hotline,
    category_fares = EXCLUDED.category_fares,
    updated_at = EXCLUDED.updated_at;

-- ============================================
-- 2. VEHICLE MAKES
-- ============================================
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

-- ============================================
-- 3. VEHICLE MODELS
-- ============================================
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

-- ============================================
-- 4. DEFAULT ADMIN USER
-- ============================================
-- Note: The admin user is created dynamically in the backend code
-- This is just a placeholder for reference
-- The actual admin credentials are:
-- Email: admin@shedrive.com
-- Password: Admin#2026!

-- ============================================
-- SEED DATA COMPLETE
-- ============================================
SELECT 'SheDrive Seed Data Inserted Successfully' AS status;
SELECT COUNT(*) AS vehicle_makes_count FROM vehicle_makes;
SELECT COUNT(*) AS vehicle_models_count FROM vehicle_models;
SELECT COUNT(*) AS admin_settings_count FROM admin_settings;
