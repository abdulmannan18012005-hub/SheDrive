-- Phase 21 / Payment System Simplification Migration
-- Adds Raast ID, Raast QR Code, Bank Account Number, and IBAN to admin_settings for monthly driver platform charges.

ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS raast_id VARCHAR(100) DEFAULT '03001234567';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS raast_qr_url TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100) DEFAULT 'PK92MEZN0009988776655';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS iban VARCHAR(100) DEFAULT 'PK92MEZN000998877665544332211';
