-- Create recurring billing table for storing recurring invoice configurations
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Customer info (copied from source invoice at creation time)
  customer_name VARCHAR(255) NOT NULL,
  customer_surname VARCHAR(255),
  customer_email VARCHAR(255) NOT NULL,
  customer_dni_cif VARCHAR(50),
  customer_phone VARCHAR(50),
  customer_address_street VARCHAR(255),
  customer_address_number VARCHAR(20),
  customer_address_postal_code VARCHAR(20),
  customer_address_city VARCHAR(100),
  customer_address_province VARCHAR(100),
  customer_address_country VARCHAR(100),
  -- Invoice details
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  iva_rate NUMERIC(5, 2) DEFAULT 10,
  iva_amount NUMERIC(12, 2),
  total NUMERIC(12, 2),
  payment_method VARCHAR(50),
  account_image_url TEXT,
  internal_notes TEXT,
  category VARCHAR(50),
  tags TEXT[],
  -- Recurring configuration
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_billing_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- Auto-send settings
  auto_send BOOLEAN DEFAULT false,
  auto_send_status VARCHAR(20) DEFAULT 'pending' CHECK (auto_send_status IN ('pending', 'sending', 'sent', 'failed')),
  -- Status tracking
  last_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  last_invoice_date DATE,
  invoice_count INTEGER DEFAULT 0,
  -- Metadata
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries by restaurant and next billing date
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_restaurant_next_billing
ON recurring_invoices(restaurant_id, next_billing_date)
WHERE is_active = true;

-- Create index for finding active recurring invoices
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_active
ON recurring_invoices(restaurant_id, is_active)
WHERE is_active = true;

-- Create table for tracking generated invoices from recurring billing
CREATE TABLE IF NOT EXISTS recurring_invoice_logs (
  id SERIAL PRIMARY KEY,
  recurring_invoice_id INTEGER NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed'))
);

-- Create index for tracking logs by recurring invoice
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_logs_recurring
ON recurring_invoice_logs(recurring_invoice_id);

-- Add recurrence fields to invoices table (to link child invoices to parent recurring config)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_invoice_id INTEGER
REFERENCES recurring_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_recurring
ON invoices(recurring_invoice_id)
WHERE recurring_invoice_id IS NOT NULL;

-- Add due_date field to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;

-- Create function to calculate next billing date based on frequency
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
  current_date DATE,
  frequency VARCHAR(20)
) RETURNS DATE AS $$
BEGIN
  CASE frequency
    WHEN 'weekly' THEN
      RETURN current_date + INTERVAL '1 week';
    WHEN 'monthly' THEN
      RETURN current_date + INTERVAL '1 month';
    WHEN 'quarterly' THEN
      RETURN current_date + INTERVAL '3 months';
    ELSE
      RETURN current_date + INTERVAL '1 month';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recurring_invoices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recurring_invoices_updated
  BEFORE UPDATE ON recurring_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_invoices_timestamp();
