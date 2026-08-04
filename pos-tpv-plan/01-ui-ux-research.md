# POS / TPV Sell Screen — UI/UX Research & Design Decisions

Research inputs: touch-POS conventions from Toast, Square for Restaurants, Lightspeed,
and Spanish TPV hostelería products (Glop, ICG Hiopos, Camarero10, TPVexpress). The
patterns below converge across vendors and are the basis for our design.

## 1. Core layout conventions (converged across vendors)

- **Category navigation is primary and persistent.** Categories live in a fixed
  panel (left column or top strip); tapping one filters the product grid instantly.
  We use a left category panel + right product grid (per the brief).
- **Product grid = large tap targets.** 1:1 tiles with image + short name, minimum
  ~44-64px touch target, generous spacing to avoid mis-taps. Color-coding or image
  differentiates items fast. We use 1:1 photos, `0.5rem` radius, name below.
- **Order/ticket panel is always visible.** The running comanda (lines, qty, price,
  running total) stays on screen so staff never lose context. We place it top-left.
- **Numeric keypad for speed operations.** Quantity, price override, quick-cash,
  covers, table number. Keypad doubles as a calculator when idle. We place it top-right.
- **Action rail for operations.** Secondary operations (send to kitchen, discount,
  split, park, pay) grouped in a consistent, thumb-reachable rail. We use the right rail.
- **Minimal chrome in service mode.** Real POS run full-bleed; app chrome is hidden
  so the whole screen is the register. We add the Integrado/Pantalla-completa switch.

## 2. Interaction principles adopted

- One tap adds a product to the active ticket; no confirm dialog for the common case.
- Selecting a ticket line makes the keypad act on it (qty/price); deselect returns to calculator.
- Destructive actions (borrar comanda, void line) confirm via `ConfirmDialog`.
- Every operation gives immediate visual feedback (line highlight, total update, toast).
- Color semantics: sent-to-kitchen vs pending, comped/invita, discounted lines are
  visually distinct (badge/border), consistent with `FoodItemCard` treatment.
- Fast, forgiving: large hit areas, no hover-only affordances (touch-first),
  keyboard operable for desktop/keyboard-cash-register use.

## 3. Responsive / device targets

- Primary: landscape tablet & desktop (1024-1920). Playwright projects already cover
  1024/1280/1440/1920 — POS must look correct in all.
- Category panel collapses to a top scroller on narrow/portrait; grid reflows columns.
- Full-screen mode is the default expectation for a real terminal; Integrado mode is
  for occasional in-backoffice use.

## 4. Visual system (reuse, do not fork)

- Use `bo-*` design tokens and the same dark/light theme as `app/comida/platos`.
- Reuse `ui/shell` Card/Panel, `ui/inputs` Select, `ui/overlays` ConfirmDialog,
  `ui/feedback` LoadingSpinner + `useErrorToast`, `ui/actions` buttons.
- Product tile mirrors `_components/FoodItemCard` (square media, radius, title, active state).
- Tokenize POS-specific sizing (tile size, keypad key size, rail width) in the POS
  stylesheet using existing CSS variables; no new color palette.

## 5. Accessibility

- All tiles/keys are real buttons with `aria-label`; grid uses `role="list"`.
- Focus-visible states; keypad operable via physical numpad.
- Contrast checked in both themes; never rely on color alone (add icon/badge/text).

## 6. Design decisions locked for implementation

1. Left category panel + right product grid; both tile = 1:1 image + name, `0.5rem` radius.
2. Top-left ticket register + top-right contextual keypad/calculator.
3. Right vertical control rail hosting the 22 operations.
4. `POSViewSwitcher` toggles Integrado vs Pantalla completa (hides Sidebar/Topbar/mobile nav).
5. One-tap add; line-select drives keypad; destructive ops confirm.
6. Strict reuse of existing components + dark/light theme.

## 7. Open questions to validate with stakeholders

- Do we want a top category strip option in addition to the left panel for portrait?
- Should the keypad support "quick cash" tender buttons (exact, 5, 10, 20) at checkout?
- Preferred rail grouping/order (selling vs table vs money vs metadata)?
