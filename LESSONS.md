# LESSONS.md — Engineering Lessons & Architectural Guardrails

> **MANDATORY**: Read this file before changing any code in HamsterStash.
> Every lesson documented here originated from a verified issue or architectural bug.
> When a rule is observed or triggered 3 or more times (`Seen: 3`), promote it to `AGENTS.md` as a permanent engineering invariant.

---

## Pattern Format

- **Rule**: Short, actionable command.
- **Why**: The technical or visual failure mode that occurs if violated.
- **Evidence**: Commit hash, regression incident, or test file demonstrating the failure.
- **Seen**: Number of occurrences observed across sessions.

---

## Lessons Log

### 1. Theme-Agnostic Card Tokens
- **Rule**: Never hardcode `#ffffff`, `#1E1D1A`, or `bg-white` on paper sheets, cards, or sawtooth pseudo-elements. Always use semantic CSS variables (`bg-(--paper-sheet)` or `var(--paper-sheet)`).
- **Why**: Hardcoded white colors break dark mode and destroy contrast on the 10 bespoke paper stationery themes (e.g., Carbon, Sage, Cotton, Kraft).
- **Evidence**: Fixed in commit `da03e34` and verified across dark theme switching.
- **Seen**: 3 (Promoted to `AGENTS.md`)

### 2. Sawtooth Drawer Overflow Clipping
- **Rule**: Never apply `overflow: hidden` on bottom sheet drawer containers decorated with `.paper-sawtooth-top`. Outer wrappers must maintain `overflow: visible`.
- **Why**: The sawtooth decoration teeth reside at `top: -6px` above the drawer boundary; `overflow: hidden` clips these teeth and destroys the receipt edge effect.
- **Evidence**: Observed during bottom sheet drawer refactoring (`AddTransactionModal.tsx`).
- **Seen**: 2

### 3. English Editorial Journal Headers
- **Rule**: Top-level page headers must use English serif titles (`November 2026`, `Statistics`, `Owned Items`, `Assets`, `Settings`) formatted in `Instrument Serif`.
- **Why**: Mobile operating systems lack default classical serif fonts for CJK glyphs, falling back to generic system sans-serif and disrupting the vintage literary editorial style.
- **Evidence**: Verified in PageHeader contract tests (`tests/components/PageHeader.test.tsx`).
- **Seen**: 3 (Promoted to `AGENTS.md`)

### 4. Strict Plugin SDK Isolation
- **Rule**: Code inside `src/plugins/**` must only import from `src/plugin-sdk` (or internal relative sibling paths within its own directory). Never import directly from `src/stores/`, `src/core/`, `src/domain/`, or `src/components/`.
- **Why**: Bypassing the SDK creates tight architectural coupling, prevents clean runtime plugin unloading, and breaks the sub-repository boundary.
- **Evidence**: Kernel isolation verified in `tests/plugin/kernel.test.ts` and `tests/plugin/owned-items-plugin.test.ts`.
- **Seen**: 3 (Promoted to `AGENTS.md`)

### 5. Skin Separation & CSS-Driven Primitives
- **Rule**: Never scatter `isModern ? ... : ...` ternaries inside leaf UI components or core/domain modules. Drive visual differences using CSS tokens under `[data-ui-style="modern"]` and split structurally divergent layouts into dedicated skin components.
- **Why**: Scattered inline conditionals degrade maintainability, clutter JSX templates, and cause UI drift between skins.
- **Evidence**: Refactored in commit `fafc784`.
- **Seen**: 1

### 6. Granular Unitized Commits & No Proactive Remote Push
- **Rule**: Decompose modifications into granular, unitized commits per discrete issue or feature slice. Never combine multiple independent tasks into one monolithic commit, and never run `git push` to a remote repository without explicit user authorization.
- **Why**: Monolithic commits obscure review diffs, break atomic git bisect, and autonomous remote pushing bypasses user review gates and can pollute remote history.
- **Evidence**: Prompted during development session after bundled commit `e2e4f34`.
- **Seen**: 1

### 7. UI De-Noising & Subtitle Purging
- **Rule**: Eliminate high-frequency CRUD toasts and redundant instructional subtitles. Routine actions (saving, updating, deleting records, toggling switches, selecting categories/themes) must remain silent with immediate DOM feedback. Reserve toasts exclusively for network tasks, bulk lifecycle operations, and validation errors. Eliminate parenthetical labels, secondary descriptions on settings switches, and instructional modal subtitles.
- **Why**: Constant toast popups create visual anxiety, obscure underlying content, and violate the physical quietude of a crafted stationery journal. Redundant subtitles waste vertical mobile viewport space and make the UI feel like an instruction manual rather than an organic notebook.
- **Evidence**: Purged 18 lightweight toasts and redundant subtitles across modal forms and WebDAV sync in commit `02491c6` and follow-up de-noising pass.
- **Seen**: 1

### 8. iOS WebKit Viewport Height Chain & Stacking Context Clipping
- **Rule**: Never apply `-webkit-fill-available` to block root containers (`#root`). Use standard `height: 100%; min-height: 100%` with `@supports (height: 100dvh) { height: 100dvh; min-height: 100dvh; }`. Ensure the outermost application shell anchors to `fixed inset-0 w-full h-full`, and never combine `position: relative`, `z-index`, and `overflow: hidden` on containing blocks that hold `position: fixed` or `position: absolute` children.
- **Why**: In WebKit (iOS Safari and WKWebView), `-webkit-fill-available` on a block container behaves as an intrinsic keyword rather than a definite length, causing child percentage heights (`height: 100%`) to collapse down to in-flow content height (~475px). This truncates absolute subpages and causes WebKit stacking context roots to clip fixed descendants like bottom navigation and floating action buttons.
- **Evidence**: Fixed in commit `1d21809`.
- **Seen**: 1

### 9. Decoupled Backdrop Blur Transitions
- **Rule**: Always isolate the backdrop blur overlay into its own dedicated element and drive its opacity using a fast easing curve (`cubic-bezier(0.16, 1, 0.3, 1)` with `will-change: opacity`). Never apply backdrop opacity transitions to an outer container that wraps the sliding sheet.
- **Why**: Bottom sheet drawers slide up rapidly with spring curves (`cubic-bezier(0.32, 0.72, 0, 1)`), reaching near-full displacement within 100ms. If the backdrop is animated with slow `ease` or attached to the sheet's parent container, WebKit defers rasterizing expensive GPU backdrop filters, causing a noticeable delay where the blur pops in a beat after the sheet finishes sliding.
- **Evidence**: Fixed in commit `458890a`.
- **Seen**: 1

### 10. Tailwind CSS v4 Linter Configuration Guardrails
- **Rule**: When using `eslint-plugin-tailwindcss` with Tailwind CSS v4, always explicitly set `settings.tailwindcss.cssConfigPath: 'src/index.css'`, disable `tailwindcss/no-custom-classname: 'off'`, and disable `tailwindcss/enforces-canonical-classname: 'off'`.
- **Why**: Tailwind v4 loads configuration from CSS stylesheets rather than a JS config file; without `cssConfigPath`, the linter fails with `ENOENT` looking for `src/style.css`. `no-custom-classname` falsely flags dynamic CSS variable tokens (such as `bg-(--paper-sheet)`), and `enforces-canonical-classname` attempts to collapse dynamic radius tokens (like `rounded-(--radius-md)`) into static Tailwind scales, breaking runtime adaptive styling between Paper and Modern skins.
- **Evidence**: Configured in `eslint.config.js` and verified with `pnpm lint`.
- **Seen**: 1

### 11. Nested Ternary Elimination & Explicit State Branches
- **Rule**: Strictly prohibit nested ternary expressions (`no-nested-ternary: 'error'`). Replace nested conditionals in templates and business logic with pure helper functions, early returns, lookup dictionaries, or explicit `if/else` ladders.
- **Why**: Deeply nested ternary expressions (`a ? b : c ? d : e`) obscure conditional branches, degrade cognitive readability, cause subtle precedence bugs, and hinder automated testing.
- **Evidence**: Enforced in `eslint.config.js` and refactored across 20+ components (`App.tsx`, `AddTransactionModal.tsx`, etc.).
- **Seen**: 1

### 12. Mandatory Pre-Development Remote Branch Sync
- **Rule**: Always run `git fetch origin` and integrate the latest `origin/main` (via fast-forward pull or rebase) before writing any code or creating local commits for a new request.
- **Why**: Developing on top of an outdated local branch diverges from upstream changes, resulting in avoidable multi-file merge conflicts, duplicated refactors, and risky rebase resolutions later.
- **Evidence**: Encountered 21 unpulled upstream commits while rebasing local feature commits onto `origin/main` (`98a878b`), requiring manual conflict resolution across the `owned-items` plugin and `StatsView.tsx`.
- **Seen**: 1

### 13. 4-Layer Data Isolation & Service DI
- **Rule**: Keep UI components and Zustand stores strictly isolated from `DataAdapter` and `BaseRepository` (`UI / Stores -> Domain Services (DI via CoreContext) -> Repositories -> DataAdapter`). Never instantiate duplicate `IndexedDBAdapter` instances or run raw soft-delete/query filtering outside repositories.
- **Why**: Direct adapter calls from stores/UI scatter tombstone checks (`!item.deletedAt`), create split IndexedDB instances or transaction races, and make swappable storage backends unsafe.
- **Evidence**: Enforced in `CoreContext`, `SeedService`, and `tests/contracts/architectureBoundary.test.ts` (commits `f22a6dd`..`4e6d930`).
- **Seen**: 1

### 14. Zero-`!important` Tailwind v4 Cascade & `tailwind-merge`
- **Rule**: Place dual-skin CSS overrides in unlayered rules in `src/index.css` without `!important` (except inside `@media (prefers-reduced-motion: reduce)`), wrap `clsx` with `tailwind-merge` inside `cn()`, and place shared `@utility` classes inside `src/styles/utilities.css`.
- **Why**: In Tailwind v4, unlayered selectors naturally win over `@layer utilities` without specificity hacks, `tailwind-merge` resolves caller className overrides deterministically, and keeping `@utility` helpers separate keeps `src/index.css` concise and maintainable.
- **Evidence**: Enforced in `tests/contracts/styleAndInvariantContracts.test.tsx` (commit `adaea3f`).
- **Seen**: 1

### 15. Proactive Clean-Architecture Evaluation During Feature Evolution
- **Rule**: Whenever a feature expands, changes data flow, or touches schema/sync boundaries, proactively audit and propose the cleanest root-cause design (eliminating redundant metadata wrappers, duplicate full-table scans, monolithic blobs, or compatibility tiers) instead of layering workarounds until the user asks for cleanup.
- **Why**: Incremental feature patches (such as stuffing duplicate-detection metadata inside `tx.ext`, computing opening balances via fake income/expense rows, double-scanning all transactions per load, or serializing entire books into a single formatted sync file) compound cognitive and maintenance debt rapidly. Addressing design cleanliness upfront yields leaner diffs and durable primitives.
- **Evidence**: Retrospectively streamlined WeChat/Alipay bill import, reconcile opening balances, and sharded WebDAV sync in commits `2d78fb1` and `3fbf6d8`.
- **Seen**: 1

### 16. Canonical Prefixed IDs, Direct Boundary Conversion & Sharded WebDAV Manifests
- **Rule**: Encode entity identity cleanly through one canonical prefix system (`acct_*`, `cat_*`, `tx_*`, `wx_*`, `ali_*`, `wealth_*`, `csv_*`), convert non-conforming or missing IDs directly with atomic foreign-key cascades at database/import boundaries rather than maintaining `legacy_` tiers, and partition WebDAV backups via content-hashed `manifest.json` shards (`settings.json`, `meta.json`, `transactions/YYYY.json`).
- **Why**: Source-encoded IDs make external imports self-deduplicating without extra `ext` metadata; direct boundary normalization prevents dual-path logic inside runtime and sync layers; manifest-hashed sharding avoids monolithic full-book uploads/downloads and preserves clean diffs across years.
- **Evidence**: Enforced via `src/domain/data/idNormalizer.ts` (`tests/domain/idNormalizer.test.ts`), `src/domain/sync/syncShards.ts` (`tests/domain/syncShards.test.ts`), and `tests/domain/autoSync.test.ts`.
- **Seen**: 1
