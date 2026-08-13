# Backend Implementation Guide: Recurring Billing

This document describes the backend implementation required for the recurring billing feature.

## Database Schema

Run the migration file `003_create_recurring_invoices.sql` to create the necessary tables:

1. **recurring_invoices** - Stores the recurring billing configuration
2. **recurring_invoice_logs** - Tracks generated invoices
3. **invoices** table modifications:
   - Add `recurring_invoice_id` column (foreign key)
   - Add `due_date` column

## API Endpoints

### List Recurring Invoices
```
GET /api/admin/recurring-invoices
Query params:
  - is_active: boolean (optional)
  - search: string (optional)
  - page: number
  - limit: number
```

### Get Single Recurring Invoice
```
GET /api/admin/recurring-invoices/:id
```

### Create Recurring Invoice
```
POST /api/admin/recurring-invoices
Body:
{
  customer_name: string,
  customer_email: string,
  amount: number,
  currency: string,
  iva_rate: number,
  payment_method: string,
  frequency: "weekly" | "monthly" | "quarterly",
  start_date: string (YYYY-MM-DD),
  end_date: string (optional),
  auto_send: boolean,
  // ... other customer fields
}
```

### Update Recurring Invoice
```
PUT /api/admin/recurring-invoices/:id
```

### Delete Recurring Invoice
```
DELETE /api/admin/recurring-invoices/:id
```

### Toggle Active Status
```
POST /api/admin/recurring-invoices/:id/toggle-active
```

### Generate Invoice Now
```
POST /api/admin/recurring-invoices/:id/generate
Response: { success: true, invoice_id: number }
```

### Pause/Resume Recurring Invoice
```
POST /api/admin/recurring-invoices/:id/pause
POST /api/admin/recurring-invoices/:id/resume
```

### Get Logs
```
GET /api/admin/recurring-invoices/:id/logs
```

## Background Job: Process Recurring Invoices

### Endpoint
```
POST /api/admin/jobs/process-recurring-invoices
```

### Implementation

```go
// Job processes all active recurring invoices that are due
func (s *Server) HandleProcessRecurringInvoices(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Get all active recurring invoices where next_billing_date <= today
    rows, err := s.db.Query(ctx, `
        SELECT id, restaurant_id, customer_name, customer_email,
               amount, currency, iva_rate, payment_method,
               frequency, start_date, end_date, auto_send
        FROM recurring_invoices
        WHERE is_active = true
          AND next_billing_date <= $1
          AND (end_date IS NULL OR end_date >= $1)
    `, time.Now().Format("2006-01-02"))

    if err != nil {
        respondError(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var processed, generated, errors int

    for rows.Next() {
        var rec RecurringInvoice
        err := rows.Scan(&rec.ID, &rec.RestaurantID, &rec.CustomerName,
            &rec.CustomerEmail, &rec.Amount, &rec.Currency, &rec.IvaRate,
            &rec.PaymentMethod, &rec.Frequency, &rec.StartDate,
            &rec.EndDate, &rec.AutoSend)

        if err != nil {
            errors++
            log.Printf("Error scanning recurring invoice: %v", err)
            continue
        }

        // Generate invoice
        invoiceID, err := s.generateInvoiceFromRecurring(ctx, rec)
        if err != nil {
            errors++
            // Log the error
            s.db.Exec(ctx, `
                INSERT INTO recurring_invoice_logs
                (recurring_invoice_id, invoice_id, status, error_message)
                VALUES ($1, 0, 'failed', $2)
            `, rec.ID, err.Error())
            continue
        }

        // Update recurring invoice with next billing date
        nextDate := calculateNextBillingDate(rec.NextBillingDate, rec.Frequency)
        s.db.Exec(ctx, `
            UPDATE recurring_invoices
            SET last_invoice_id = $1,
                last_invoice_date = $2,
                next_billing_date = $3,
                invoice_count = invoice_count + 1
            WHERE id = $4
        `, invoiceID, time.Now().Format("2006-01-02"), nextDate, rec.ID)

        // Log success
        s.db.Exec(ctx, `
            INSERT INTO recurring_invoice_logs
            (recurring_invoice_id, invoice_id, status)
            VALUES ($1, $2, 'success')
        `, rec.ID, invoiceID)

        // Auto-send if enabled
        if rec.AutoSend {
            go s.sendInvoiceAuto(invoiceID)
        }

        generated++
        processed++
    }

    respondJSON(w, map[string]interface{}{
        "success": true,
        "processed": processed,
        "generated": generated,
        "errors": errors,
    })
}

func calculateNextBillingDate(currentDate time.Time, frequency string) time.Time {
    switch frequency {
    case "weekly":
        return currentDate.AddDate(0, 0, 7)
    case "monthly":
        return currentDate.AddDate(0, 1, 0)
    case "quarterly":
        return currentDate.AddDate(0, 3, 0)
    default:
        return currentDate.AddDate(0, 1, 0)
    }
}
```

## Cron Job Setup

Set up a cron job to run the process-recurring-invoices endpoint daily:

```bash
# Run at 6:00 AM every day
0 6 * * * curl -X POST http://localhost:8080/api/admin/jobs/process-recurring-invoices
```

Or configure in your application's job scheduler:

```go
// In your main.go or job scheduler setup
scheduler := cron.New()
scheduler.AddFunc("0 6 * * *", func() {
    // Call process-recurring-invoices endpoint
})
scheduler.Start()
```

## Invoice Linkage

When generating an invoice from a recurring config:
1. Copy all customer info from the recurring config
2. Set the `recurring_invoice_id` on the new invoice
3. Track generation in `recurring_invoice_logs`
