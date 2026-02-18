-- Migration to add invoice split functionality
-- This adds support for tracking invoice splits (分裂)

-- Add split tracking columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS is_split_parent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_split_child BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS split_parent_id INTEGER,
ADD COLUMN IF NOT EXISTS split_percentage NUMERIC(5,2);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_split_parent ON invoices(split_parent_id) WHERE split_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_is_split_parent ON invoices(is_split_parent) WHERE is_split_parent = TRUE;
CREATE INDEX IF NOT EXISTS idx_invoices_is_split_child ON invoices(is_split_child) WHERE is_split_child = TRUE;
