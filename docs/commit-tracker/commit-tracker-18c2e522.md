# Commit Tracker - 18c2e522

Session: 2026-07-30 12:45

## Changes

| Time | File | Action | What Done |
|------|------|--------|-----------|
| 12:45 | docs/pos-button-improvements-plan.md | add | Plan 12 POS button improvements with TDD. |
| 13:15 | pages/app/pos/types/register.ts | add | Centralize POS register contracts. |
| 13:15 | pages/app/pos/utils/paymentAllocation.ts | add | Split sale, tip, and tenders safely. |
| 13:15 | pages/app/pos/utils/paymentAllocation.test.ts | add | Test cash, card, tip allocation. |
| 13:15 | pages/app/pos/utils/customerTaxId.ts | add | Normalize and validate Spanish tax IDs. |
| 13:15 | pages/app/pos/utils/customerTaxId.test.ts | add | Test tax ID validation cases. |
| 13:15 | pages/app/pos/hooks/usePOSRegister.ts | edit | Harden POS commands and persisted state. |
| 13:15 | pages/app/pos/hooks/usePOSRegister.test.ts | edit | Test POS command edge cases. |
| 13:15 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx | edit | Complete 12 rail button workflows. |
| 13:15 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx | edit | Test improved rail workflows. |
| 13:15 | pages/app/pos/functionalComponents/POSSellScreen/POSTicketPanel.tsx | edit | Show visit and line metadata. |
| 13:15 | pages/app/pos/functionalComponents/POSSellScreen/POSPromptModal.tsx | edit | Add validation and field variants. |
| 13:15 | pages/app/pos/functionalComponents/POSSellScreen/POSMultiSelectDialog.tsx | add | Add merge and tags selector. |
| 13:15 | components/styles/features/pos/sell-screen.css | edit | Style POS metadata and dialogs. |
| 13:15 | e2e/specs/pos/pos.spec.ts | edit | Cover all improved POS buttons. |
| 13:17 | pages/app/pos/functionalComponents/POSSellScreen/POSKeypad.tsx | edit | Remove stale lint suppression. |
| 13:31 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx | edit | Add area chip spacing hook. |
| 13:31 | components/styles/features/pos/sell-screen.css | edit | Add 1rem area bottom margin. |
| 13:55 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx | edit | Allow void order without typed reason. |
| 13:55 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx | edit | Test no-reason void option. |
| 13:58 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx | edit | Remove checkbox; make void reason optional. |
| 13:58 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx | edit | Test direct no-reason deletion. |
| 14:05 | pages/app/pos/hooks/usePOSRegister.ts | edit | Track automatic reservation availability. |
| 14:05 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx | edit | Auto-load reservations on table modal. |
| 14:05 | pages/app/pos/pos.test.tsx | edit | Test automatic reservation selection. |
| 14:05 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx | edit | Test empty reservations fallback. |
| 14:15 | docs/pos-comanda-pdf-plan.md | add | Plan Comanda PDF download with TDD. |
| 14:19 | pages/app/pos/utils/comandaPdf.test.ts | add | Test A6 comanda PDF content and filename. |
| 14:19 | pages/app/pos/utils/comandaPdf.ts | add | Generate A6 non-fiscal comanda PDF. |
| 14:21 | pages/app/pos/functionalComponents/POSSellScreen/POSControlRail.tsx | edit | Add Comanda rail button below Total. |
| 14:21 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.tsx | edit | Wire comanda download with busy guard. |
| 14:21 | pages/app/pos/functionalComponents/POSSellScreen/POSSellScreen.test.tsx | edit | Test comanda placement, guards and errors. |
| 14:22 | e2e/specs/pos/pos.spec.ts | edit | Verify comanda browser download. |
