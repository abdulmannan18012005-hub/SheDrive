-- Add ride_shares table for Share My Ride feature
-- This table stores share tokens that allow public tracking of rides

CREATE TABLE IF NOT EXISTS ride_shares (
    id VARCHAR(64) PRIMARY KEY,
    ride_id VARCHAR(64) NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
    share_token VARCHAR(64) UNIQUE NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ride_shares_token ON ride_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_ride_shares_ride_id ON ride_shares(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_shares_expires_at ON ride_shares(expires_at);

-- Add share_token and share_expires_at columns to rides table for convenience
ALTER TABLE rides ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS share_expires_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_rides_share_token ON rides(share_token) WHERE share_token IS NOT NULL;
