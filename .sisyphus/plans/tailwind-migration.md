# Tailwind CSS Migration Plan

## TL;DR

> **Quick Summary**: Migrate entire codebase from vanilla CSS (bo.css) to Tailwind CSS. Tailwind already configured, but 123 files still use `bo-` classes.
> 
> **Deliverables**: 
> - Extended Tailwind config with design tokens from bo.css
> - All UI components migrated to Tailwind classes
> - All pages migrated to Tailwind classes  
> - Menu-preview static HTML migrated to Tailwind
> - bo.css removed after successful migration
> 
> **Estimated Effort**: XL (massive refactor)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Extend Tailwind config → UI Components → Pages → Menu Preview → Delete bo.css

---

## Context

### Original Request
"Migrate the whole website to tailwind-css"

### Interview Summary
**Key Discussions**:
- Scope: Everything (backoffice + menu-preview/public website)
- Strategy: Full replacement - rewrite components with Tailwind classes, delete bo.css after
- Priority: Core UI first (UI components → Pages → Menu preview)
- Test: Build verification only after each wave
- No exclusions

**Research Findings**:
- Tailwind already configured (tailwind.config.ts with shadcn/ui theme)
- shadcn/ui components already use Tailwind
- 22,181 lines of bo.css to replace
- 123 files use `bo-` CSS classes:
  - 82 pages in `pages/`
  - 62 UI components in `ui/`
- Menu-preview uses separate `vc-*` CSS system (not bo.css) - needs separate Tailwind migration

### Metis Review
**Identified Gaps** (addressed):
- Menu-preview uses separate CSS system (vc-*) - plan includes this as separate migration
- Tailwind config needs extension with spacing, typography, shadows, transitions tokens
- Need build + typecheck verification after each wave
- Need to track bo- class usage to know when safe to delete bo.css

---

## Work Objectives

### Core Objective
Migrate all CSS from vanilla bo.css and vc-* systems to Tailwind CSS utility classes, preserving exact visual output and accessibility.

### Concrete Deliverables
- Extended `tailwind.config.ts` with design tokens from bo.css
- All 62 UI components converted to Tailwind classes
- All 82 pages converted to Tailwind classes
- All 43 menu-preview HTML files converted to Tailwind classes
- Both `components/bo.css` and `public/bo.css` removed
- `public/menu-preview/base.css` and theme.css files migrated/removed

### Definition of Done
- [ ] `grep -r "bo-" --include="*.tsx" --include="*.jsx"` returns 0 results
- [ ] `grep -r "vc-" public/menu-preview/ --include="*.html"` returns 0 results  
- [ ] `npm run build` passes without errors
- [ ] `npm run typecheck` passes (if exists)
- [ ] Dark theme renders correctly
- [ ] Light theme renders correctly

### Must Have
- Preserve all `aria-*`, `role`, and focus states (accessibility)
- Maintain exact same visual output (pixel-perfect migration)
- Support both dark and light themes
- Keep `@apply` usage minimal

### Must NOT Have
- Change any React component logic/behavior - only CSS classes
- Add new features - only migrate existing styles
- Update shadcn/ui or other dependencies
- Add visual effects not in original

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vite + TypeScript)
- **Automated tests**: NO - build verification only
- **Framework**: N/A
- **Verification**: Build + typecheck after each wave

### QA Policy
Every task MUST include agent-executed QA scenarios.
- **Build verification**: `npm run build` and `npm run typecheck`
- **Grep verification**: Count remaining `bo-` class references
- **Theme verification**: Check both dark and light themes render

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - EXTEND TAILWIND CONFIG):
├── Task 1: Extend Tailwind config with spacing tokens from bo.css
├── Task 2: Extend Tailwind config with typography tokens from bo.css  
├── Task 3: Extend Tailwind config with shadows and radius tokens
├── Task 4: Extend Tailwind config with transition tokens
├── Task 5: Add custom bo- utility classes for complex patterns
└── Task 6: Verify build passes with extended config

Wave 2 (UI Components - SAMPLE PROOF OF CONCEPT):
├── Task 7: Migrate 3-5 core UI components as proof-of-concept
├── Task 8: Verify build + typecheck pass
├── Task 9: Visual verification of migrated components (dark + light)
└── Task 10: Commit proof-of-concept changes

Wave 3 (UI Components - FULL MIGRATION):
├── Task 11: Migrate remaining UI components (~57 files)
├── Task 12: Verify build + typecheck pass
├── Task 13: Verify no remaining bo- classes in ui/
├── Task 14: Commit UI components migration

Wave 4 (Pages - MIGRATION):
├── Task 15: Migrate app layout pages (sidebar, topbar, shell)
├── Task 16: Migrate dashboard and high-traffic pages
├── Task 17: Migrate remaining pages (~80 files)
├── Task 18: Verify build + typecheck pass
├── Task 19: Verify no remaining bo- classes in pages/
├── Task 20: Commit pages migration

Wave 5 (Menu Preview - STATIC HTML):
├── Task 21: Migrate base.css to Tailwind
├── Task 22: Migrate villa-carmen theme to Tailwind
├── Task 23: Migrate remaining 5 themes to Tailwind
├── Task 24: Verify all menu-preview HTML uses Tailwind classes
├── Task 25: Verify no remaining vc- classes in menu-preview/
├── Task 26: Commit menu-preview migration

Wave 6 (CLEANUP):
├── Task 27: Final build + typecheck verification
├── Task 28: Delete components/bo.css
├── Task 29: Delete public/bo.css (if different file)
├── Task 30: Delete menu-preview/base.css and theme.css files
├── Task 31: Commit cleanup

Critical Path: Task 1-6 → Task 7-10 → Task 11-14 → Task 15-20 → Task 21-26 → Task 27-31
```

### Dependency Matrix
- **1-6**: — — 7-10
- **7-10**: 1-6 — 11-14, 7-10
- **11-14**: 7-10 — 15-20, 8
- **15-20**: 11-14 — 21-26, 12
- **21-26**: 15-20 — 27-31, 18
- **27-31**: 21-26 — (none)

### Agent Dispatch Summary
- **1**: **6** — config tasks → `unspecified-high`
- **2**: **4** — sample migration → `visual-engineering`
- **3**: **4** — UI components → `visual-engineering`
- **4**: **6** — pages → `visual-engineering`
- **5**: **6** — menu-preview → `visual-engineering`
- **6**: **5** — cleanup → `quick`

---

## TODOs

> Every task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] 1. Extend Tailwind config with spacing tokens from bo.css

  **What to do**:
  - Read `components/bo.css` to extract `--bo-space-*` tokens
  - Add spacing scale to `tailwind.config.ts` under `theme.extend.spacing`
  - Map: 4px→1, 8px→2, 12px→3, 16px→4, 24px→5, 32px→6, 48px→8

  **Must NOT do**:
  - Don't change existing shadcn color config
  - Don't add new colors - use existing or extend

  **Recommended Agent Profile**:
  > **Category**: `unspecified-high`
    - Reason: Config file extension - straightforward but needs precision
  > **Skills**: [`villacarmen-backoffice-ssr`]
    - `villacarmen-backoffice-ssr`: Required for accessing bo.css tokens
  > **Skills Evaluated but Omitted**:
    - (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: Task 6, then Wave 2
  - **Blocked By**: None (can start immediately)

  **References**:
  - `components/bo.css:1-120` - CSS variable tokens (spacing, colors, typography)
  - `tailwind.config.ts` - Current Tailwind config to extend
  - Official docs: `https://tailwindcss.com/docs/customizing-spacing` - Spacing config

  **Acceptance Criteria**:
  - [ ] tailwind.config.ts has spacing scale matching bo.css
  - [ ] npm run build passes

- [x] 2. Extend Tailwind config with typography tokens from bo.css
- [x] 3. Extend Tailwind config with shadows and radius tokens
- [x] 4. Extend Tailwind config with transition tokens
- [x] 5. Add custom bo- utility classes for complex patterns

  **What to do**:
  - Identify complex bo- patterns that don't map 1:1 to Tailwind
  - Add custom utilities in shadcn.css @layer utilities

  **Recommended Agent Profile**:
  > **Category**: `unspecified-high`
  > **Skills**: [`villacarmen-backoffice-ssr`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1

  **Acceptance Criteria**:
  - [ ] Complex patterns have Tailwind equivalents

- [x] 6. Verify build passes with extended config

  **What to do**:
  - Run `npm run build` to verify Tailwind config is valid
  - Run `npm run typecheck` if available

  **Recommended Agent Profile**:
  > **Category**: `quick`
    - Reason: Simple verification command
  > **Skills**: []
  > **Skills Evaluated but Omitted**:
    - (none)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after 1-5)
  - **Blocks**: Wave 2
  - **Blocked By**: Tasks 1-5

  **QA Scenarios**:

  Scenario: Build verification
    Tool: Bash
    Preconditions: Tailwind config extended
    Steps:
      1. Run `npm run build`
    Expected Result: Build completes without errors
    Evidence: .sisyphus/evidence/task-6-build.log

  **Acceptance Criteria**:
  - [ ] npm run build passes
  - [ ] npm run typecheck passes

- [x] 7. Migrate 3-5 core UI components as proof-of-concept

- [x] 8. Verify build + typecheck pass

- [x] 9. Visual verification of migrated components (dark + light)

  **What to do**:
  - Manually verify 3-5 migrated components render correctly
  - Check dark theme and light theme
  - Compare to original bo.css rendering

  **Recommended Agent Profile**:
  > **Category**: `unspecified-high`
    - Reason: Visual verification requires checking output

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after 8)
  - **Blocks**: Task 10
  - **Blocked By**: Task 8

  **Acceptance Criteria**:
  - [ ] Dark theme matches original
  - [ ] Light theme matches original
  - [ ] No visual regressions

- [x] 10. Commit proof-of-concept changes

  **What to do**:
  - Create git commit for POC migration
  - Message: `refactor: migrate sample UI components to Tailwind`

  **Recommended Agent Profile**:
  > **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (final)
  - **Blocks**: Wave 3
  - **Blocked By**: Task 9

  **Commit**: YES
  - Message: `refactor: migrate sample UI components to Tailwind`
  - Files: `tailwind.config.ts`, `ui/actions/Button.tsx`, `ui/widgets/StatCard.tsx`, `ui/overlays/Modal.tsx`
  - Pre-commit: `npm run build`

- [x] 11. Migrate remaining UI components (~57 files)

- [x] 12. Verify build + typecheck pass

- [x] 13. Verify no remaining bo- classes in ui/

- [x] 14. Commit UI components migration

  **What to do**:
  - Create commit for full UI migration

  **Recommended Agent Profile**:
  > **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: Wave 4
  - **Blocked By**: Task 13

  **Commit**: YES
  - Message: `refactor: migrate all UI components to Tailwind`
  - Files: All files in ui/ directory
  - Pre-commit: `npm run build`

- [x] 15. Migrate app layout pages (sidebar, topbar, shell)

- [x] 16. Migrate dashboard and high-traffic pages

- [x] 17. Migrate remaining pages (~80 files)

  **What to do**:
  - Migrate all remaining pages in pages/ directory

  **Recommended Agent Profile**:
  > **Category**: `visual-engineering`
  > **Skills**: [`villacarmen-backoffice-ssr`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 18
  - **Blocked By**: Task 16

  **References**:
  - `pages/` - All page files

  **Acceptance Criteria**:
  - [ ] All pages use Tailwind classes

- [x] 18. Verify build + typecheck pass

  **What to do**:
  - Run build and typecheck

  **Recommended Agent Profile**:
  > **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after 17)
  - **Blocks**: Task 19, Task 20
  - **Blocked By**: Task 17

  **Acceptance Criteria**:
  - [ ] npm run build passes
  - [ ] npm run typecheck passes

- [x] 19. Verify no remaining bo- classes in pages/

  **What to do**:
  - Grep verification for pages directory

  **QA Scenarios**:

  Scenario: Verify no bo- classes in pages/
    Tool: Bash
    Preconditions: Pages migrated
    Steps:
      1. Run `grep -r "bo-" pages/ --include="*.tsx" --include="*.jsx"`
    Expected Result: No matches
    Evidence: .sisyphus/evidence/task-19-grep.txt

  **Acceptance Criteria**:
  - [ ] grep returns 0 results

- [x] 20. Commit pages migration

  **What to do**:
  - Commit all page migrations

  **Commit**: YES
  - Message: `refactor: migrate all pages to Tailwind`
  - Files: All files in pages/ directory

- [ ] 21. Migrate base.css to Tailwind (menu-preview)

  **What to do**:
  - Migrate `public/menu-preview/base.css` to Tailwind
  - Note: Uses vc-* variables, separate from bo.css

  **Must NOT do**:
  - Don't confuse with bo.css - this is separate system

  **Recommended Agent Profile**:
  > **Category**: `visual-engineering`
  > **Skills**: [`villacarmen-backoffice-ssr`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 22
  - **Blocked By**: Task 20

  **References**:
  - `public/menu-preview/base.css` - Source CSS

  **Acceptance Criteria**:
  - [ ] base.css patterns converted to Tailwind

- [ ] 22. Migrate villa-carmen theme to Tailwind

  **What to do**:
  - Migrate villa-carmen theme.css to Tailwind

  **Recommended Agent Profile**:
  > **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 24
  - **Blocked By**: Task 21

  **References**:
  - `public/menu-preview/templates/villa-carmen/theme.css`

- [ ] 23. Migrate remaining 5 themes to Tailwind

  **What to do**:
  - Migrate: sea-breeze, nocturne-copper, terra-olive, lumen-gold, preact-copy

  **Recommended Agent Profile**:
  > **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 22)
  - **Blocks**: Task 24
  - **Blocked By**: Task 22

  **Acceptance Criteria**:
  - [ ] All themes migrated

- [ ] 24. Verify all menu-preview HTML uses Tailwind classes

  **What to do**:
  - Check HTML files for Tailwind class usage

  **QA Scenarios**:

  Scenario: Verify Tailwind in menu-preview
    Tool: Bash
    Preconditions: Themes migrated
    Steps:
      1. Check HTML files contain Tailwind classes
    Expected Result: Tailwind classes present

  **Acceptance Criteria**:
  - [ ] HTML files use Tailwind classes

- [ ] 25. Verify no remaining vc- classes in menu-preview/

  **What to do**:
  - Grep verification for vc- classes

  **QA Scenarios**:

  Scenario: Verify no vc- classes
    Tool: Bash
    Preconditions: Menu-preview migrated
    Steps:
      1. Run `grep -r "vc-" public/menu-preview/ --include="*.html"`
    Expected Result: No matches
    Evidence: .sisyphus/evidence/task-25-grep.txt

  **Acceptance Criteria**:
  - [ ] grep returns 0 results

- [ ] 26. Commit menu-preview migration

  **Commit**: YES
  - Message: `refactor: migrate menu-preview to Tailwind`

- [ ] 27. Final build + typecheck verification

  **What to do**:
  - Final comprehensive build check

  **QA Scenarios**:

  Scenario: Final build verification
    Tool: Bash
    Preconditions: All migrations complete
    Steps:
      1. Run `npm run build`
      2. Run `npm run typecheck`
    Expected Result: Both pass
    Evidence: .sisyphus/evidence/task-27-build.log

  **Acceptance Criteria**:
  - [ ] npm run build passes
  - [ ] npm run typecheck passes

- [ ] 28. Delete components/bo.css

  **What to do**:
  - Remove bo.css file after verifying no consumers

  **Must NOT do**:
  - Don't delete until 100% verified no bo- classes remain

  **Recommended Agent Profile**:
  > **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6
  - **Blocks**: Task 31
  - **Blocked By**: Task 27

  **Acceptance Criteria**:
  - [ ] File deleted
  - [ ] Build still passes

- [ ] 29. Delete public/bo.css (if different file)

  **What to do**:
  - Remove duplicate bo.css from public/

  **Recommended Agent Profile**:
  > **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 28)

  **Acceptance Criteria**:
  - [ ] File deleted

- [ ] 30. Delete menu-preview/base.css and theme.css files

  **What to do**:
  - Remove old CSS files from menu-preview

  **Recommended Agent Profile**:
  > **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 28)

  **Acceptance Criteria**:
  - [ ] Old CSS files deleted

- [ ] 31. Commit cleanup

  **Commit**: YES
  - Message: `refactor: remove legacy CSS files after Tailwind migration`
  - Files: Deleted files, any remaining config changes
  - Pre-commit: `npm run build`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify all Must Have items present and Must NOT Have items absent.

- [ ] F2. **Build Verification** — `unspecified-high`
  Run full build and typecheck.

- [ ] F3. **Grep Verification** — `quick`
  Verify no bo- or vc- classes remain anywhere.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify only CSS changed, no logic modifications.

---

## Commit Strategy

- Wave 1: `config: extend Tailwind with design tokens from bo.css`
- Wave 2: `refactor: migrate sample UI components to Tailwind`
- Wave 3: `refactor: migrate all UI components to Tailwind`
- Wave 4: `refactor: migrate all pages to Tailwind`
- Wave 5: `refactor: migrate menu-preview to Tailwind`
- Wave 6: `refactor: remove legacy CSS files after Tailwind migration`

---

## Success Criteria

### Verification Commands
```bash
npm run build                    # Must pass
npm run typecheck               # Must pass (if exists)
grep -r "bo-" pages/ ui/ --include="*.tsx" --include="*.jsx"  # Must return 0
grep -r "vc-" public/menu-preview/ --include="*.html"         # Must return 0
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Build passes
- [ ] No remaining bo- or vc- class references
- [ ] Legacy CSS files deleted
