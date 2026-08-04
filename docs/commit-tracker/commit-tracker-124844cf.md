# Commit Tracker - 124844cf

Session: 2026-07-27T18:18:54Z

## Changes

| Time | File | Action | What Done |
|------|------|--------|-----------|
| 18:20 | PENDING_INTEGRATIONS_PLAN.md | add | Plan all pending integrations. |
| 18:21 | POS_IMPLEMENTATION_STATUS.md | edit | Link integration master plan. |
| 18:21 | POS_IMPLEMENTATION_PLAN.md | edit | Link deferred integration plan. |
| 18:21 | STOCK_CONTROL_PLAN.md | edit | Link dependency delivery plan. |
| 18:22 | todo.md | edit | Refresh pending integration summary. |
| 18:28 | ../backend/internal/db/migrations/067_pending_integrations_foundation.sql | add | Add integration foundation schema. |
| 18:31 | ../backend/internal/config/config.go | edit | Add private storage config. |
| 18:32 | ../backend/internal/api/bunny_storage.go | edit | Add private object operations. |
| 18:36 | ../backend/internal/api/backoffice_stock_documents.go | edit | Retain and audit private originals. |
| 18:39 | ../backend/internal/api/backoffice_accounting_exports.go | add | Add deterministic accounting exports. |
| 18:41 | ../backend/internal/api/backoffice_pos_reservations.go | add | Add reservation visit integration. |
| 18:42 | ../backend/internal/api/backoffice_pos.go | edit | Reuse linked reservation visits. |
| 18:45 | ../backend/internal/api/backoffice_production_labour.go | add | Allocate actual production labour. |
| 18:46 | ../backend/internal/api/backoffice_integrations_test.go | add | Test integration foundations. |
| 18:47 | ../backend/cmd/ops-check/main.go | add | Add scheduled operations audit. |
| 18:47 | ../backend/deploy/villacarmen-ops-check.service | add | Add operations systemd service. |
| 18:47 | ../backend/deploy/villacarmen-ops-check.timer | add | Add nightly operations timer. |
| 18:48 | ../backend/internal/api/server.go | edit | Register integration routes. |
| 18:50 | pages/app/pos/pos.tsx | edit | Add reservations and accounting exports. |
| 18:50 | pages/app/pos/pos.test.tsx | edit | Test reservation seating payload. |
| 18:51 | pages/app/stock/functionalComponents/StockDocumentsPanel/StockDocumentsPanel.tsx | edit | Add private original controls. |
| 18:51 | pages/app/stock/functionalComponents/StockDocumentsPanel/StockDocumentsPanel.test.tsx | edit | Test private original controls. |
| 18:52 | pages/app/stock/functionalComponents/ProductionLabourPanel/ProductionLabourPanel.tsx | add | Add actual labour allocation UI. |
| 18:52 | pages/app/stock/functionalComponents/ProductionLabourPanel/ProductionLabourPanel.test.tsx | add | Test actual labour allocation. |
| 18:52 | pages/app/stock/stock.tsx | edit | Mount production labour panel. |
| 18:54 | ../backend/.env.example | edit | Document private storage variables. |
| 18:54 | ../backend/ENDPOINTS.md | edit | Document integration endpoints. |
| 18:55 | PENDING_INTEGRATIONS_PLAN.md | edit | Mark delivered foundations. |
| 18:55 | POS_IMPLEMENTATION_STATUS.md | edit | Record integration foundations. |
| 18:58 | INTEGRATIONS_OPERATIONS_RUNBOOK.md | add | Add deploy and rollback runbook. |
| 19:02 | ../backend/cmd/pos-load/main.go | add | Add authenticated checkout load tool. |
| 19:05 | ../backend/cmd/ops-check/main_test.go | add | Test operations issue counts. |
