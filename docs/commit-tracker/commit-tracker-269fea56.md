# Commit Tracker - 269fea56

Session: 2026-07-28T11:56:21Z

## Changes

| Time | File | Action | What Done |
|------|------|--------|-----------|
| 11:48 | ../backend/internal/api/backoffice_pos_test.go | edit | Test KDS and activation rules. |
| 11:48 | pages/app/pos/pos.test.tsx | edit | Test kitchen dispatch. |
| 11:48 | pages/app/pos/functionalComponents/KitchenDisplay/KitchenDisplay.test.tsx | add | Test KDS ready flow. |
| 11:51 | ../backend/internal/db/migrations/068_pos_kitchen_and_activation.sql | add | Add KDS and activation schema. |
| 11:54 | ../backend/internal/api/backoffice_pos_kitchen.go | add | Add KDS and activation APIs. |
| 11:55 | ../backend/internal/api/backoffice_pos.go | edit | Gate LIVE modes. Add permission. |
| 11:55 | ../backend/internal/api/backoffice_pos_admin.go | edit | Expose kitchen permission. |
| 11:55 | ../backend/internal/api/server.go | edit | Register KDS activation routes. |
| 11:56 | pages/app/pos/functionalComponents/KitchenDisplay/KitchenDisplay.tsx | add | Add internal KDS screen. |
| 11:56 | pages/app/pos/pos.tsx | edit | Add kitchen tab and dispatch. |
| 12:00 | ../backend/internal/api/backoffice_pos_checkout.go | edit | Require standalone card reference. |
| 12:00 | ../backend/internal/api/backoffice_pos_reports.go | edit | Add card reconciliation report. |
| 12:03 | pages/app/pos/functionalComponents/POSActivationPanel/POSActivationPanel.test.tsx | add | Test LIVE acceptance. |
| 12:03 | pages/app/pos/functionalComponents/POSActivationPanel/POSActivationPanel.tsx | add | Add readiness acceptance UI. |
| 12:04 | pages/app/pos/functionalComponents/KitchenSettings/KitchenSettings.test.tsx | add | Test station creation. |
| 12:05 | pages/app/pos/functionalComponents/KitchenSettings/KitchenSettings.tsx | add | Add station routing UI. |
| 12:10 | pages/app/pos/functionalComponents/CardReconciliation/CardReconciliation.test.tsx | add | Test card reconciliation. |
| 12:10 | pages/app/pos/functionalComponents/CardReconciliation/CardReconciliation.tsx | add | Add terminal reconciliation UI. |
| 12:12 | POS_IMPLEMENTATION_STATUS.md | edit | Mark KDS and gates done. |
| 12:12 | PENDING_INTEGRATIONS_PLAN.md | edit | Update KDS delivered scope. |
| 12:12 | todo.md | edit | Mark browser KDS implemented. |
| 12:13 | ../backend/ENDPOINTS.md | edit | Document KDS gates card APIs. |
| 12:40 | ui/shell/Sidebar.test.tsx | edit | Test Stock TPV navigation. |
| 12:40 | ui/nav/MobileNav.test.tsx | edit | Test Stock TPV mobile links. |
| 12:41 | ui/shell/Sidebar.tsx | edit | Pin Stock TPV mobile navbar. |
| 12:41 | ui/nav/MobileNav.tsx | edit | Add Stock TPV bottom links. |
| 12:42 | ui/nav/sectionIcons.tsx | edit | Add Stock icon mapping. |
| 12:46 | lib/rbac.test.ts | add | Test admin Stock TPV visibility. |
| 12:46 | lib/rbac.ts | edit | Preserve admin Stock TPV access. |
| 12:47 | pages/app/backoffice/backoffice.test.tsx | add | Test backoffice module links. |
| 13:05 | components/styles/base/variables.css | edit | Add AA state text tokens. |
| 13:10 | components/styles/features/stock/stock-page.css | add | Add stock layout stylesheet. |
| 13:10 | components/bo.css | edit | Import stock stylesheet. |
| 13:12 | pages/app/stock/stock.tsx | edit | Use shared UI primitives. |
| 13:12 | pages/app/stock/functionalComponents/StockImportPanel/StockImportPanel.tsx | edit | Use shared UI primitives. |
| 13:12 | pages/app/stock/functionalComponents/StockCountPanel/StockCountPanel.tsx | edit | Use shared UI primitives. |
| 13:13 | pages/app/stock/functionalComponents/StockOperationsPanel/StockOperationsPanel.tsx | edit | Use shared UI primitives. |
| 13:13 | pages/app/stock/functionalComponents/StockSettingsPanel/StockSettingsPanel.tsx | edit | Use shared UI primitives. |
| 13:14 | pages/app/stock/functionalComponents/StockDocumentsPanel/StockDocumentsPanel.tsx | edit | Use shared UI primitives. |
| 13:14 | pages/app/stock/functionalComponents/ProductionLabourPanel/ProductionLabourPanel.tsx | edit | Use shared UI primitives. |
| 13:17 | pages/app/stock/stock.test.tsx | edit | Test styling and labels. |
| 13:20 | e2e/specs/stock/stock-console.spec.ts | add | Real-backend console audit. |
| 13:22 | backend internal/db/migrations/065_pos_sales.sql | edit | Fix table_id FK type. |
| 13:30 | backend internal/api/backoffice_stock_analytics.go | edit | Quote reserved usage alias. |
| 13:38 | e2e/specs/stock/stock-ui.spec.ts | add | Contrast and a11y audit. |
| 13:40 | ui/nav/SimpleTabs.tsx | edit | Always name tabs. |
| 13:40 | components/styles/features/stock/stock-page.css | edit | Keep mobile tab labels. |
| 14:05 | COMIDA_STOCK_TECHNICAL_SHEETS_PLAN.md | add | Plan comida stock technical sheets. |
| 14:40 | COMIDA_STOCK_TECHNICAL_SHEETS_PLAN.md | edit | Apply owner decisions. |
| 15:05 | COMIDA_STOCK_TECHNICAL_SHEETS_PLAN.md | edit | Add scoped margin band tables. |
| 15:35 | ui/widgets/allergens/allergens.ts | add | Canonical allergen list. |
| 15:35 | ui/widgets/allergens/allergens.test.ts | add | Allergen normalization tests. |
| 15:36 | ui/widgets/allergens/AllergenIconList.tsx | add | Shared allergen icon list. |
| 15:36 | ui/widgets/allergens/AllergenIconList.test.tsx | add | Derived lock tests. |
| 15:37 | ui/widgets/menus/MenuDishPreviewCard.tsx | edit | Use shared allergen list. |
| 15:37 | ui/widgets/menus/MenuDishPreviewCard.test.tsx | add | Allergen regression tests. |
| 15:37 | components/styles/components/allergens.css | add | Allergen list styles. |
| 15:37 | components/styles/features/menus/menu-wizard.css | edit | Drop duplicated icon rule. |
| 15:37 | components/bo.css | edit | Import allergen styles. |
| 15:38 | pages/app/comida/@foodType/@foodId/constants/allergens.sync.test.ts | add | Guard comida drift. |
| 15:38 | ui/widgets/index.ts | edit | Export allergen widgets. |
| 16:00 | backend internal/db/migrations/069_comida_production_type_and_stock_link.sql | add | comida production_type + stock link cols. |
| 16:00 | backend internal/db/migrations/070_recipe_output_unique_key_rebuild.sql | add | Generated col + status guard. |
| 16:00 | backend internal/db/migrations/071_recipe_steps_and_image_jobs.sql | add | Recipe steps + AI image jobs. |
| 16:00 | backend internal/db/migrations/072_margin_scopes_and_cdn_sweep.sql | add | Scope bands + CDN sweep; drop legacy. |
| 16:00 | backend internal/db/migrations/schema_constraints_test.go | add | DB-enforced guarantees (10 tests). |
| 16:00 | backend internal/api/backoffice_stock_analytics.go | edit | New §8.4 zone boundaries. |
| 16:00 | backend internal/api/backoffice_stock_margin_scopes.go | add | Scope CRUD + resolve + defaults. |
| 16:00 | backend internal/api/backoffice_stock_margin_scopes_test.go | add | Validate + resolve unit tests. |
| 16:00 | backend internal/api/backoffice_stock_margin_scopes_integration_test.go | add | HTTP round-trip tests. |
| 16:00 | backend internal/api/server.go | edit | Swap margin routes. |
| 16:00 | backend internal/api/backoffice_stock_analytics_test.go | edit | New boundary table. |
| 16:00 | pages/app/stock/functionalComponents/MarginBandsPanel/marginBands.ts | add | Boundary helpers. |
| 16:00 | pages/app/stock/functionalComponents/MarginBandsPanel/marginBands.test.ts | add | Helper tests. |
| 16:00 | pages/app/stock/functionalComponents/MarginBandsPanel/MarginBandsPanel.tsx | add | Atomic 3-boundary editor. |
| 16:00 | pages/app/stock/functionalComponents/MarginBandsPanel/MarginBandsPanel.test.tsx | add | Component tests. |
| 16:00 | pages/app/stock/functionalComponents/StockSettingsPanel/StockSettingsPanel.tsx | edit | Replace band CRUD with panel. |
| 16:00 | pages/app/stock/functionalComponents/StockSettingsPanel/StockSettingsPanel.test.tsx | edit | Mock margin-scopes. |
| 16:20 | backend internal/api/backoffice_stock.go | edit | Add 8 sheet/production-type permission constants + stockPermissionKeys catalogue. |
| 16:20 | backend internal/api/backoffice_stock_permissions.go | add | Stock role-permission GET/PUT; sparse rows, role-default fallback, catalogue-only writes. |
| 16:20 | backend internal/api/backoffice_stock_permissions_test.go | add | 4 catalogue unit tests + 4 real-MySQL HTTP tests. |
| 16:20 | backend internal/api/server.go | edit | Route /stock/roles/{slug}/permissions behind stockSettingsGate. |
| 16:35 | backend internal/api/allergens.go | add | 14 EU allergens, alias/accent normalization, manual layer, derivation walk (depth 12 + cycle guard). |
| 16:35 | backend internal/api/allergens_test.go | add | 13 tests incl. frontend-sync guard + derived-cannot-be-disabled. |
| 16:35 | backend internal/api/backoffice_technical_sheets.go | add | Sheet CRUD; atomic create of output item+unit; publish gate; allergen GET/PATCH. |
| 16:35 | backend internal/api/backoffice_technical_sheets_test.go | add | 7 real-MySQL handler tests. |
| 16:35 | backend internal/api/server.go | edit | Route /comida/technical-sheets behind stock.sheets.* gates. |
| 18:10 | backend internal/api/backoffice_technical_sheet_components.go | add | Component CRUD; base-unit conversion on write, unit-belongs-to-item check, transitive cycle guard, allergen cache refresh. |
| 18:10 | backend internal/api/backoffice_technical_sheet_components_test.go | add | 10 real-MySQL tests incl. A→B→A cycle and tenant scoping. |
| 18:10 | backend internal/api/backoffice_technical_sheet_cost.go | add | Pure cost engine + graph loader + HTTP handler; missing price ⇒ costComplete=false, zone withheld. |
| 18:10 | backend internal/api/backoffice_technical_sheet_cost_test.go | add | 12 tests incl. missing-price-is-not-zero and waste yield. |
| 18:10 | backend internal/api/backoffice_technical_sheet_steps.go | add | Steps CRUD + reorder; contiguous step_no, park-offset avoids CHECK(step_no>0). |
| 18:10 | backend internal/api/backoffice_technical_sheet_steps_test.go | add | 8 tests incl. gap-closing delete and rejected partial reorder. |
| 18:10 | backend internal/api/backoffice_technical_sheet_duplicate.go | add | Deep copy in one tx; own output item, DRAFT, copied_from traceability. |
| 18:10 | backend internal/api/backoffice_technical_sheet_duplicate_test.go | add | 5 tests incl. copy-independence. |
| 18:10 | backend internal/api/backoffice_technical_sheet_link.go | add | production_type PATCH, sheet list/search, usage, in-use-guarded delete. |
| 18:10 | backend internal/api/backoffice_technical_sheet_link_test.go | add | 9 tests incl. cross-tenant link rejection and 409 on in-use delete. |
| 18:10 | backend internal/api/backoffice_technical_sheets_test.go | edit | Cleanup deletes children before parents so FK blocks cannot leak rows. |
| 18:10 | backend internal/api/server.go | edit | 15 sheet routes + sheetsDelete/sheetsSteps/productionType gates. |
| 18:20 | pages/app/comida/_components/TechnicalSheet/sheetsApi.ts | add | Typed REST transport for sheets. |
| 18:20 | pages/app/comida/_components/TechnicalSheet/ProductionTypeToggle.tsx(+test) | add | RAW/MANUFACTURED radiogroup; server-confirmed state, 4 tests. |
| 18:20 | pages/app/comida/_components/TechnicalSheet/TechnicalSheetPicker.tsx(+test) | add | Duplicate-vs-link picker with usage warning, 5 tests. |
| 18:20 | pages/app/comida/_components/TechnicalSheet/TechnicalSheetEditor.tsx(+test) | add | Info/Receta/Coste subtabs, 6 tests. |
| 18:20 | pages/app/comida/_components/TechnicalSheet/TechnicalSheet{Info,Recipe,Cost}Tab.tsx | add | Locked derived allergens, ordered steps, incomplete-cost banner. |
| 18:20 | components/styles/features/comida/technical-sheets.css | add | Sheet styles; non-colour state signals, 44px targets. |
| 18:20 | components/bo.css | edit | Import technical-sheets.css. |
| 18:30 | e2e/specs/comida/technical-sheets.spec.ts | add | Real-backend lifecycle E2E (create→publish-guard→steps→cost→duplicate→delete). |
| 18:40 | backend internal/api/backoffice_stock_margin_targets.go | add | Scope-key validation against real category tables + targets endpoint with inheritance chain. |
| 18:40 | backend internal/api/backoffice_stock_margin_targets_test.go | add | 7 tests: unknown/unqualified/foreign keys rejected, target inheritance, null when unset. |
| 18:40 | backend internal/api/backoffice_stock_margin_scopes.go | edit | PUT now rejects scope keys that point at nothing. |
| 18:40 | backend cmd/ops-check/main.go | edit | Report unresolvable margin scopes (platos/bebidas/stock each against its own table). |
| 18:40 | backend cmd/ops-check/main_test.go | edit | 2 tests: orphan scope counts as an issue; open visits do not. |
| 18:45 | backend cmd/cdn-sweep/sweep.go | add | Pure sweep planner: grace window, ratio guard, query-failure abort, path normalisation. |
| 18:45 | backend cmd/cdn-sweep/sweep_test.go | add | 11 safety tests incl. >50% abort and fresh-object protection. |
| 18:45 | backend cmd/cdn-sweep/storage.go | add | bunnyList tree walk (did not exist), object cap, delete helper. |
| 18:45 | backend cmd/cdn-sweep/registry.go | add | Reviewed reference-column registry + unknown-column tripwire. |
| 18:45 | backend cmd/cdn-sweep/registry_schema_test.go | add | Pins the registry against the REAL schema. |
| 18:45 | backend cmd/cdn-sweep/main.go | add | GET_LOCK, dry-run default, audited runs/deletions, private zone excluded. |
| 18:45 | backend deploy/villacarmen-cdn-sweep.{service,timer} | add | Nightly, report-only (no --apply) pending 7-night review. |
| 18:48 | backend internal/api/backoffice_technical_sheet_images.go | add | Step image jobs: queue, idempotency, publish/fail with WS notify. |
| 18:48 | backend internal/api/backoffice_technical_sheet_images_test.go | add | 9 tests incl. cancelled job must not publish, tenant scoping. |
| 18:48 | backend internal/api/backoffice_technical_sheet_image_worker.go | add | Poller: SKIP LOCKED claim, stuck-job reclaim, T2I/I2I, NormalizeToWebP → Bunny. |
| 18:48 | backend internal/api/backoffice_technical_sheets_ws.go | add | Single type-discriminated socket: sheet search + image-job status; REST stays authoritative. |
| 18:48 | backend internal/api/server.go | edit | sheetHub wiring + image-job, bulk-link and WS routes. |
| 18:50 | backend internal/db/migrations/073_comida_bulk_link_batches.sql | add | Bulk-link idempotency + audit; NOT NULL key so the unique index is total. |
| 18:50 | backend internal/api/backoffice_technical_sheet_bulk.go | add | Wizard preview (non-mutating) + all-or-nothing apply in one tx. |
| 18:50 | backend internal/api/backoffice_technical_sheet_bulk_test.go | add | 7 tests incl. partial-batch rollback and retry idempotency. |
| 18:50 | pages/app/stock/functionalComponents/PortionWastePanel/PortionWastePanel.tsx(+test) | add | Merma UI: negative WASTE movement, mandatory reason, idempotency key; 5 tests. |
| 18:50 | pages/app/stock/stock.tsx | edit | Mount PortionWastePanel. |
| 11:05 | backend internal/api/comida.go | edit | Expose production_type/stock_recipe_id/stock_item_id on VINOS list (mirrors comida_items). |
| 11:05 | backend internal/api/backoffice_technical_sheet_link.go | edit | production-type PATCH accepts source=vinos (VINOS keys on num); usage query UNIONs wine with an explicit collation. |
| 11:05 | backend internal/api/comida_production_fields_test.go | edit | +4 wine tests: list fields, RAW default, PATCH, revert clears link. |
| 11:05 | backend internal/api/backoffice_technical_sheet_link_test.go | edit | +1 test: a sheet used by a wine cannot be deleted (was silently deletable). |
| 11:05 | api/types.ts | edit | production_type/stock links on Vino. |
| 11:05 | pages/app/comida/_components/TechnicalSheet/ProductionTypeToggle.tsx | edit | Made fully controlled + source prop; removed the internal copy that reverted a saved change. |
| 11:05 | pages/app/comida/_components/TechnicalSheet/TechnicalSheetPicker.tsx | edit | source prop so wine links write to VINOS. |
| 11:05 | pages/app/comida/_components/TechnicalSheet/sheetsApi.ts | edit | setProductionType carries source. |
| 11:05 | .../WineDetailEditor/WineDetailEditor.tsx(+test) | edit | Sheet section for wine; re-seed only on wine change; 5 tests. |
| 11:05 | .../FoodDetailQuickEditor/FoodDetailQuickEditor.tsx | edit | Re-seed only when a different product is opened. |
| 11:05 | e2e/specs/comida/technical-sheet-wine.spec.ts | add | Real-stack wine E2E incl. persistence across reload. |
| 13:00 | backend internal/db/migrations/074_postres_production_type.sql | add | POSTRES gets production_type/stock links (missed by 069); idempotent PREPARE/EXECUTE guards. |
| 13:00 | backend internal/db/migrations/schema_constraints_test.go | edit | +1 test: postres columns exist and default to RAW. |
| 13:00 | backend internal/api/comida.go | edit | postres list carries production_type/stock links; wine DETAIL query too. |
| 13:00 | backend internal/api/backoffice_vinos.go | edit | boVino carries the stock link; BOTH /vinos list and /vinos/{id} now return it (the page loads via the LIST). |
| 13:00 | backend internal/api/backoffice_technical_sheet_link.go | edit | PATCH routes to comida_items/VINOS/POSTRES by source; usage UNION gains a postres branch. |
| 13:00 | backend internal/api/comida_production_fields_test.go | edit | +7 tests: postres list/default/patch/revert, sheet-in-use, wine detail + wine list exposure. |
| 13:00 | backend cmd/comida-stock-backfill/ | add | Links all 194 catalogue products to stock items. Dry-run default, GET_LOCK, idempotent via UNIQUE sku, RAW only, NO stock movements. 13 tests. |
| 13:00 | pages/app/comida/_components/TechnicalSheet/ProductionTypeSection.tsx(+test) | add | Always-visible Preparado/Materia prima switch + inline subtabs; 8 tests. |
| 13:00 | pages/app/comida/_components/TechnicalSheet/ProductionTypeToggle.tsx | edit | Wording -> Preparado/Materia prima; deferSave for unsaved products; postres source. |
| 13:00 | pages/app/comida/{_components/FoodItemModal,@foodType/@foodId/.../FoodDetailQuickEditor,.../WineDetailEditor}.tsx | edit | All four editors now render the shared section. |
| 13:00 | pages/app/comida/@foodType/@foodId/hooks/useFoodDetailPage.ts(+test) | edit | detailEditorSupport() extracted; postres get the detail editor for the first time; 3 tests. |
| 13:00 | e2e/specs/comida/production-type-all-types.spec.ts | add | Real-stack E2E: switch present for all 5 types, Preparado reveals subtabs, wine survives reload; state-independent helper. |
| 13:35 | backend internal/api/backoffice_technical_sheet_ensure.go | add | POST /comida/technical-sheets/ensure: creates AND links a sheet in one locked transaction, idempotent per product. Replaces the client-side create+link that raced itself. |
| 13:35 | backend internal/api/backoffice_technical_sheet_link.go | edit | Reverting to Materia prima discards an UNTOUCHED draft sheet (and its output item); a sheet with ingredients/steps is kept - user work is not disposable. |
| 13:35 | backend internal/api/backoffice_technical_sheet_bulk_test.go | edit | +4 tests: ensure is idempotent, reuses an existing link, discards untouched drafts, keeps worked-on sheets. |
| 13:35 | pages/app/comida/_components/TechnicalSheet/ProductionTypeSection.tsx | edit | Choosing Preparado now auto-creates the sheet and opens the three tabs inline, ready for ingredients (was a dead-end "Asignar ficha" button). |
| 13:35 | pages/app/comida/_components/TechnicalSheet/sheetsApi.ts | edit | ensureForProduct(). |
| 13:35 | pages/app/comida/**/[FoodItemModal|FoodDetailQuickEditor|WineDetailEditor].technicalSheet.test.tsx | edit | Assert the tabs open directly instead of a picker button. |
| 13:35 | e2e/specs/comida/production-type-all-types.spec.ts | edit | Asserts the three tabs appear on Preparado for all 5 types; state-independent; raised timeout for the sheet round trips. |
