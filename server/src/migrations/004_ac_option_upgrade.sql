-- Migration 004: Add ac_option column to drivers table
-- Supports 'ac', 'non_ac', and 'both' for driver vehicle AC preferences
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ac_option VARCHAR(20) DEFAULT 'both';
