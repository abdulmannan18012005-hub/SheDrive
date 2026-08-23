-- ============================================
-- Phase 4: SOS Alerts Table for Emergency Safety
-- ============================================

-- Create sos_alerts table for PostgreSQL persistence of emergency SOS events
CREATE TABLE IF NOT EXISTS sos_alerts (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  user_role VARCHAR(50) CHECK (user_role IN ('passenger', 'driver')),
  ride_id VARCHAR(64),
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at BIGINT NOT NULL,
  resolved_at BIGINT
);

-- Index for efficient querying of recent active alerts
CREATE INDEX IF NOT EXISTS idx_sos_alerts_created_at ON sos_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_id ON sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
