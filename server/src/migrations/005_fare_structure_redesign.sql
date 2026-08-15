-- SheDrive SQL Migration 005: Fare Structure Redesign
-- Updates fare configuration to follow industry-standard ride-hailing pricing
-- Each vehicle category now has its own complete pricing structure

-- 1. Remove global base_fare column from admin_settings
ALTER TABLE admin_settings DROP COLUMN IF EXISTS base_fare;

-- 2. Remove global min_fare_floor column from admin_settings
ALTER TABLE admin_settings DROP COLUMN IF EXISTS min_fare_floor;

-- 3. Update category_fares JSON structure to include perMinuteRate and minimumFare
-- The new structure for each category should be:
-- {
--   "id": "bike",
--   "name": "Bike / Scooty",
--   "baseFare": 60,
--   "perKmRate": 25,
--   "perMinuteRate": 2,
--   "minimumFare": 50
-- }

-- Replace category_fares with new structure if it's NULL, empty, or missing new fields
UPDATE admin_settings 
SET category_fares = '[{"id":"bike","name":"Bike / Scooty","baseFare":60,"perKmRate":25,"perMinuteRate":2,"minimumFare":50},{"id":"mini","name":"SheDrive Mini","baseFare":100,"perKmRate":40,"perMinuteRate":3,"minimumFare":80},{"id":"sedan","name":"SheDrive Sedan AC","baseFare":150,"perKmRate":50,"perMinuteRate":4,"minimumFare":120},{"id":"comfort","name":"SheDrive Comfort AC","baseFare":180,"perKmRate":60,"perMinuteRate":5,"minimumFare":150},{"id":"premium","name":"SheDrive Premium","baseFare":250,"perKmRate":80,"perMinuteRate":6,"minimumFare":200},{"id":"family","name":"SheDrive Family XL","baseFare":300,"perKmRate":90,"perMinuteRate":7,"minimumFare":250}]'::jsonb
WHERE category_fares IS NULL 
   OR jsonb_array_length(category_fares) = 0 
   OR NOT (category_fares ? 'perMinuteRate')
   OR NOT (category_fares ? 'minimumFare');
