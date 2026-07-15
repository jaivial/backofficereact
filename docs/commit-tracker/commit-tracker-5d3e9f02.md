# commit-tracker-5d3e9f02

me add whatsapp bot settings UI to /app/config?content=ia (root-only IA tab). root can pick restaurant, choose LLM model, tune personality, and see the generated system prompt.

## files me touch

- `pages/app/config/functionalComponents/ConfigWhatsAppBot/ConfigWhatsAppBot.tsx` — NEW panel:
  - restaurant SearchableSelect (all restaurants from session, root see all)
  - model SearchableSelect (MiniMax-M3/M2/Text-01 + "Por defecto del sistema (X)" showing backend defaultModel)
  - idioma es/en, tono input, instrucciones personalizadas textarea, teléfono contacto override, switch desactivar adjuntos
  - system prompt preview: collapsible `<pre>` with refrescar button, re-render on save
  - toasts on save ok/error. loads on restaurant change.
- `pages/app/config/config.tsx` — IA tab now render ConfigAIImage + ConfigWhatsAppBot (root only). pass session restaurants + activeRestaurantId from pageContext.bo.
- `api/client.ts` — config.getBotSettings(rid) / config.saveBotSettings(rid, input) → GET/PUT /api/admin/bot/settings/{restaurantId}.
- `api/types.ts` — BotTenantConfig type (model, language_default, tone, greeting_style, disable_attachments, custom_instructions, contact_phone).

## backend pair

backend tracker commit-tracker-2f8b5a17.md: new root-only endpoints return config + promptPreview + defaultModel; `model` field override global BOT model per restaurant.

## checks

- bun run typecheck clean, lint:jsx pass (443 files), eslint clean on touched files.
- backoffice service restarted, active.

## update 2: rules editor + tenant data card + phone prefill

- ConfigWhatsAppBot.tsx:
  - new tenant data card on top (brandName, phone, address, rices list, horarios, límite diario) fetched live per restaurant — shows what dynamic data the prompt uses.
  - new "Reglas críticas" textarea: shows effective rules (custom or defaults), editable per restaurant, "Restaurar por defecto" button, hint text when customized vs default.
  - contact phone input now prefilled from restaurant_info.telefono (backend prefill) + placeholder shows restaurant phone.
- api/types.ts: BotTenantConfig += rules; new BotRestaurantData + BotSettingsResponse types.
- api/client.ts: getBotSettings/saveBotSettings typed with BotSettingsResponse.
- typecheck + lint:jsx + eslint clean. backoffice restarted.

## update 3: live system prompt in UI

- ConfigWhatsAppBot.tsx:
  - prompt preview now VISIBLE by default (showPreview=true), taller (max-h 32rem), labeled "System prompt construido (datos dinámicos + reglas + personalización)".
  - LIVE preview: any field edit (model/tone/rules/instructions/phone/idioma) debounce 600ms → POST /preview → prompt re-render server-side with the draft config, without saving. seq guard against out-of-order responses. dirty flag skip initial load.
  - hint text explains prompt rebuilt per message with live data.
- api/client.ts: config.previewBotSettings(rid, input).
