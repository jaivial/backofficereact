-- Create invoice_attachments table for storing multiple attachments per invoice
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups by invoice_id
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice_id ON invoice_attachments(invoice_id);
