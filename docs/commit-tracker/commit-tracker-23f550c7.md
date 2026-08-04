# Commit Tracker - 23f550c7

Session: 2026-08-19

## Changes

| Time | File | Action | What Done |
|------|------|--------|-----------|
| 00:00 | ../backend/internal/api/backoffice_stock.go | edit | Format stock API code. |
| 00:00 | ../backend/internal/api/backoffice_stock_recipes.go | edit | Format recipe API code. |
| 00:00 | ../backend/internal/api/backoffice_stock_analytics.go | edit | Format analytics API code. |
| 00:00 | ../backend/internal/api/backoffice_rbac.go | edit | Format stock RBAC code. |
| 00:00 | ../backend/internal/api/server.go | edit | Format stock routes. |
| 15:00 | ../backend/internal/db/migrations/062_stock_forecast_costing_ocr.sql | edit | Fix OCR tenant keys. Add aliases. |
| 15:00 | ../backend/internal/api/backoffice_stock_documents.go | add | Add multimodal OCR review flows. |
| 15:00 | ../backend/internal/api/backoffice_stock_analytics.go | edit | Add MiniMax M3 vision payload. |
| 15:00 | ../backend/internal/api/backoffice_stock_recipes.go | edit | Add nested BOM explosion. |
| 15:00 | ../backend/internal/api/backoffice_stock_import.go | add | Add CSV XLSX import. |
| 15:00 | pages/app/stock/functionalComponents/StockDocumentsPanel/StockDocumentsPanel.tsx | add | Add OCR review UI. |
| 15:00 | pages/app/stock/stock.tsx | edit | Mount OCR panel. |
| 15:20 | ../backend/internal/db/migrations/060_stock_control.sql | edit | Add profiles. Fix warehouse FK. |
| 15:20 | ../backend/internal/db/migrations/061_stock_recipes.sql | edit | Add sub-recipe FK. |
| 15:20 | ../backend/internal/db/migrations/062_stock_forecast_costing_ocr.sql | edit | Add AI usage reports. |
| 15:25 | ../backend/internal/api/backoffice_stock_reconciliation.go | add | Add ledger audit rebuild. |
| 15:30 | pages/app/stock/functionalComponents/StockCountPanel/StockCountPanel.tsx | add | Add physical count UI. |
| 15:30 | pages/app/stock/functionalComponents/StockImportPanel/StockImportPanel.tsx | add | Add catalog import UI. |
| 15:30 | pages/app/stock/functionalComponents/StockOperationsPanel/StockOperationsPanel.tsx | add | Add recipe forecast costing UI. |
| 15:30 | pages/app/stock/functionalComponents/StockSettingsPanel/StockSettingsPanel.tsx | add | Add stock onboarding settings. |
| 15:45 | ../backend/ENDPOINTS.md | edit | Document complete stock API. |
| 15:45 | STOCK_CONTROL_PLAN.md | edit | Record implemented status. |
| 16:08 | ../backend/internal/db/migrations/063_member_compensation_and_recipe_labour.sql | add | Add salary history and recipe labour. |
| 16:10 | ../backend/internal/api/backoffice_labour_cost.go | add | Add salary CRUD and labour reports. |
| 16:10 | ../backend/internal/api/backoffice_labour_cost_test.go | add | Test salary and labour math. |
| 16:12 | ../backend/internal/api/backoffice_stock_recipes.go | edit | Save recipe labour and snapshots. |
| 16:12 | ../backend/internal/api/backoffice_stock_analytics.go | edit | Include labour in recipe cost. |
| 16:12 | ../backend/internal/api/server.go | edit | Register salary labour routes. |
| 16:15 | api/types.ts | edit | Add salary labour contracts. |
| 16:15 | api/client.ts | edit | Add salary labour API client. |
| 16:15 | pages/app/miembros/@memberId/contrato/+data.ts | edit | Load admin salary history. |
| 16:15 | pages/app/miembros/@memberId/contrato/+Page.tsx | edit | Manage salary history. |
| 16:15 | pages/app/miembros/@memberId/contrato/functionalComponents/CompensationPanel/CompensationPanel.tsx | add | Add salary CRUD UI. |
| 16:15 | pages/app/miembros/@memberId/contrato/functionalComponents/CompensationPanel/CompensationPanel.test.tsx | add | Test salary CRUD UI. |
| 16:17 | pages/app/fichaje/+data.ts | edit | Load labour cost report. |
| 16:17 | pages/app/fichaje/+Page.tsx | edit | Show labour cost report. |
| 16:17 | pages/app/fichaje/functionalComponents/LabourCostReport/LabourCostReport.tsx | add | Add actual labour report. |
| 16:17 | pages/app/fichaje/functionalComponents/LabourCostReport/LabourCostReport.test.tsx | add | Test labour report. |
| 16:18 | pages/app/stock/functionalComponents/StockOperationsPanel/StockOperationsPanel.tsx | edit | Add recipe labour editor. |
| 16:22 | ../backend/ENDPOINTS.md | edit | Document salary labour API. |
| 16:22 | STOCK_CONTROL_PLAN.md | edit | Mark labour costing delivered. |
| 16:22 | todo.md | edit | Add full implementation TODO. |
