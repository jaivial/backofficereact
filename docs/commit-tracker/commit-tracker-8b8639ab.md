# Commit Tracker - 8b8639ab

Session: 2026-07-23T13:16:03Z

## Changes

| Time | File | Action | What Done |
|------|------|--------|-----------|
| 13:30 | pages/app/settings/functionalComponents/WhatsAppConnection/WhatsAppConnection.test.tsx | add | Test QR WebSocket settings flow. |
| 13:36 | pages/app/settings/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | add | Add simple realtime QR onboarding. |
| 13:36 | pages/app/settings/settings.tsx | edit | Show WhatsApp in restaurant settings. |
| 13:36 | pages/app/config/config.tsx | edit | Remove root-only connection panel. |
| 13:36 | pages/app/config/functionalComponents/ConfigWhatsAppBot/WhatsAppConnection.tsx | delete | Remove polling connection UI. |
| 13:36 | pages/app/config/functionalComponents/ConfigWhatsAppBot/WhatsAppConnection.test.ts | delete | Replace old state tests. |
| 13:36 | api/types.ts | edit | Add entitlement connection contract. |
| 13:36 | api/client.ts | edit | Remove self-subscription methods. |
| 13:36 | server/index.ts | edit | Proxy WhatsApp WebSocket safely. |
| 13:36 | components/styles/features/settings/whatsapp-connection.css | edit | Style QR instructions. |
| 13:40 | vitest.setup.ts | edit | Add jsdom ResizeObserver stub. |
| 13:47 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Test real settings WebSocket flow. |
| 13:53 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Verify QR scan UI end-to-end. |
| 14:15 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Catch missing settings APIs. |
| 14:20 | pages/app/settings/settings.tsx | edit | Remove unsupported renumber calls. |
| 14:20 | pages/app/settings/functionalComponents/RenumberPanel/RenumberPanel.tsx | delete | Remove broken renumber UI. |
| 14:20 | api/client.ts | edit | Remove nonexistent renumber endpoints. |
| 14:20 | api/types.ts | edit | Remove unused renumber contracts. |
| 14:52 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Support connected live instance. |
| 15:10 | pages/app/settings/functionalComponents/WhatsAppConnection/WhatsAppConnection.test.tsx | edit | Test reusable disconnect modal. |
| 15:15 | pages/app/settings/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | edit | Use reusable disconnect dialog. |
| 15:22 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Test disconnect dialog recovery. |
| 15:42 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Verify real delayed QR display. |
| 16:05 | e2e/specs/config/whatsapp-live.spec.ts | add | Test real disconnect and QR. |
| 16:15 | e2e/specs/config/whatsapp-live.spec.ts | edit | Always clean live provider state. |
| 17:20 | e2e/specs/config/whatsapp-live.spec.ts | edit | Require decoded QR image. |
| 18:00 | pages/app/settings/functionalComponents/WhatsAppConnection/WhatsAppConnection.test.tsx | edit | Test hidden unsubscribed panel. |
| 18:00 | e2e/specs/config/whatsapp-bot.spec.ts | edit | Test Contact placement. |
| 18:00 | e2e/specs/config/whatsapp-live.spec.ts | edit | Use Contact config route. |
| 18:05 | pages/app/settings/functionalComponents/WhatsAppConnection/* | move | Move WhatsApp UI to Contact config. |
| 18:05 | pages/app/settings/settings.tsx | edit | Remove WhatsApp panel. |
| 18:05 | pages/app/config/functionalComponents/ConfigContacto/ConfigContacto.tsx | edit | Add WhatsApp panel. |
| 18:05 | pages/app/config/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | edit | Hide without plan entitlement. |
| 18:15 | pages/app/config/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | edit | Add 1rem panel padding. |
| 18:20 | pages/app/config/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | edit | Center QR waiting status. |
| 18:20 | components/styles/features/settings/whatsapp-connection.css | edit | Align waiting icon and text. |
| 18:25 | pages/app/config/functionalComponents/WhatsAppConnection/WhatsAppConnection.test.tsx | edit | Test QR cancellation. |
| 18:27 | pages/app/config/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | edit | Add QR cancel button. |
| 18:27 | components/styles/features/settings/whatsapp-connection.css | edit | Center QR actions. |
| 18:30 | pages/app/config/functionalComponents/WhatsAppConnection/WhatsAppConnection.tsx | edit | Center stack via style props. |

## Verification

- `bun run test` — 45 files, 234 tests pass.
- `bun run lint` — TypeScript and JSX checks pass.
- Playwright real app — 8 pass, including live provider connection.
- Production-domain settings regression — 2 pass; no missing admin APIs.
- Production-domain disconnect modal regression — pass.
- Production-domain live WhatsApp state regression — pass.
- Production-domain real disconnect → QR → disconnect E2E — pass.
- Evolution PNG QR decode assertion — pass.
- Contact relocation E2E — 10 pass, 1 live test skipped.
- Unsubscribed Contact panel — hidden by backend entitlement.
- `newvillacarmen-backoffice.service` — active TLS dev server on port 3010.
