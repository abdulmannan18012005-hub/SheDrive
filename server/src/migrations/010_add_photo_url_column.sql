-- Add photo_url column to users table for profile picture storage
-- This migration adds support for storing profile pictures as base64 data URIs

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
