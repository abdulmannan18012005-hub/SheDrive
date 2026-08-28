-- SheDrive Database Migration 018: Spatial and Location Performance Indexes
-- Accelerates Haversine distance calculations, nearby driver searches, and spatial queries

CREATE INDEX IF NOT EXISTS idx_drivers_lat_lng ON drivers(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_rides_pickup_coords ON rides(pickup_latitude, pickup_longitude);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_coords ON rides(dropoff_latitude, dropoff_longitude);
CREATE INDEX IF NOT EXISTS idx_saved_places_user_id ON saved_places(user_id);
