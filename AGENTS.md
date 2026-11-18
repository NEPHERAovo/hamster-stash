# AGENTS.md — HamsterStash Development Guide & Architecture Spec

> **MANDATORY**: Before changing any code, read `LESSONS.md` and `.agents/skills/paper-design-director/SKILL.md`.
> All agents and engineers must strictly follow the rules documented here.

---

## 1. Project Overview

**HamsterStash** is a minimal, local-first progressive web app (PWA) designed for personal and micro-business expense tracking.

- **Fast & Focused Capture**: Zero distracting animations; instant launch; transaction entry completes in under 3 seconds.
- **Crafted Stationery Design System**:
  - Subtle warm paper base with a micro-dot grid background.
  - Natural low-saturation functional colors (cypress green income, terra-cotta red expense).
  - Clean vector line icons (`lucide-react`) exclusively—emojis are strictly banned from UI chrome.
  - Flat paper sheets with hairline rules and physical deckle/sawtooth cuts instead of heavy glassmorphism.
- **Pluggable Data Layer**: Storage abstracted via `DataAdapter` interface, completely decoupling UI from persistence (IndexedDB by default; WebDAV/cloud sync ready).
- **Mobile-First Offline PWA**: Optimized for vertical mobile viewport, fully installable and operational without network access.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | ^19.3.0 | Functional components & hooks |
| Language | TypeScript | ~5.9.3 | Strict mode, zero `any` |
| Bundler | Vite | ^7.1.9 | Fast ESM dev server and build |
| Styling | Tailwind CSS | ^4.3.5 | Utility-first with semantic CSS variables |
| Icons | lucide-react | ^1.73.0 | Vector line iconography |
| State | Zustand | ^5.1.0 | Sliced reactive stores |
| Local Storage | idb | ^8.0.4 | Lightweight IndexedDB promise wrapper |
| Offline / PWA | vite-plugin-pwa + workbox | ^1.1.0 / ^7.4.0 | Service Worker precaching & offline runtime |
| Routing | react-router-dom | ^7.18.5 | Tab navigation and subpage transitions |
| Package Manager | pnpm | ^11.x (or 9.x+) | Strict lockfile enforcement |
| Linter | ESLint + typescript-eslint | ^9.x | Zero errors, zero warnings standard |

---

## 3. Dual-Language & Boundary Architecture

To ensure professional engineering collaboration and seamless user localization:

1. **Engineering & Build Layer (100% English)**:
   - `AGENTS.md`, `LESSONS.md`, `README.md`, Git commit messages and bodies, test descriptions (`describe`/`it`), CI workflows, and allowed technical comments must be written in clear, concise English.
   - `AGENTS.md` and `LESSONS.md` must contain zero literal CJK characters (`/[\u4e00-\u9fa5]/`).
2. **Product & UI Layer (Chinese-Dominant)**:
   - User-facing UI labels, form placeholders, button copy, category names, account types, and toast messages must be concise, natural native Chinese.
   - **Exception**: Top-level serif journal headers (`November 2026`, `Statistics`, `Owned Items`, `Assets`, `Settings`) remain in English to preserve classical literary typography on mobile devices.
   - **Concise Copywriting**: Never use engineering jargon, debugging codes, or explanatory parentheses in user-facing copy.

---

## 4. Visual Design & Theme System

### 4.1 Design Principles
1. **Paper Materiality & Pulp Texture**: Global lightweight SVG turbulence noise (`<feTurbulence>`) gives background surfaces organic tactile texture.
2. **Per-Day Receipt Sheets**: Transactions are bundled inside individual receipt cards (`bg-(--paper-sheet)`) grouped by date with `1px dashed` receipt hairlines.
3. **Notepad Bottom Sheet**:
   - Drawer top edge features a genuine receipt sawtooth cut (`.paper-sawtooth-top`). Outer containers must maintain `overflow: visible` to prevent tooth clipping.
   - Washi tape strip (`.washi-tape`) pinned at the top center.
   - Integrated 4x4 desktop calculator keypad with an inline `4x2` stamp-block category grid.
   - 3-column mechanical drum-wheel picker for date and time.
4. **Theme Semantic Variables**:
   - **Zero Hardcoded Colors**: Cards, sheets, and cut edges must use semantic tokens (`bg-(--paper-sheet)`, `bg-(--paper-sunken)`, `var(--rule-hairline)`).
   - Built-in 10 themes: 5 Light (Sage, Cotton, Kraft, Mist, Cherry) and 5 Dark (Carbon, Indigo, Espresso, Obsidian, Pine).
5. **Dual Typography Axis**:
   - Financial figures & tabular metrics: Strict `Geist Mono` (`tabular-nums`).
   - Mastheads & journal receipts: Literary `Instrument Serif`.

### 4.2 Dual-Skin Architecture: Paper vs. Modern Glass

The application supports two distinct aesthetic skins (`paper` and `modern`), governed by a strict 3-layer architectural hierarchy:

1. **Layer 1 — Shared Core & Plugins (Zero Skin Awareness)**:
   - Core domain services (`src/domain/**`), state management (`src/stores/**` except `useThemeStore`), database (`src/core/**`), and plugins (`src/plugins/**`, `src/plugin-sdk/**`) must remain completely skin-agnostic.
   - Core and plugins render exclusively through semantic UI primitives (`PaperCard`, `CategoryBadge`, `SegToggle`, `PaperButton`, `PaperInput`) with zero conditional JS branches checking `uiStyle`.

2. **Layer 2 — Pure CSS-Driven Leaf Primitives (Zero Inline Skin Ternaries)**:
   - Leaf UI primitives (`PaperCard`, `PaperButton`, `PaperInput`, `CategoryBadge`, `SegToggle`, `PaperKeypad`, `PaperModal`, `Toast`) encapsulate their presentation using CSS design tokens (`--paper-sheet`, `--paper-sunken`, `--rule-hairline`, `--btn-radius`, `--input-radius`, `--keypad-radius`, etc.).
   - Visual enhancements (such as `backdrop-filter: blur(20px)`, pill radii, and glow shadows under `[data-ui-style="modern"]`) are applied purely via CSS rules in `src/index.css`. No inline JS `isModern ? ... : ...` ternaries are allowed inside leaf primitives.

3. **Layer 3 — Dedicated Implementations for Structurally Divergent Shells**:
   - Where physical mechanics, layout topology, or DOM hierarchy fundamentally differ, components are split into dedicated skin shells rather than mixing conditional JSX:
     - **Navigation Routing**: `BottomNav.tsx` acts purely as a thin router dispatching to `<PaperBottomNav />` (stationery tabs + square FAB) or `<ModernBottomNav />` (`<LiquidGlassDock />` + circular FAB).
     - **Ledger Grouping**: `TransactionGroup.tsx` delegates date-block rendering to `<PaperTransactionGroup />` (per-day receipt cards with dashed dividers) or `<ModernTransactionGroup />` (floating date headers above rounded glass cards with nested rows).
     - **Modals & Keypads**: Physical paper ornaments (washi tape, deckle cuts, sawtooth receipt edges) are separated from sleek spatial sheets via CSS tokens and structured slots.

4. **Modern Theme Simplification (Light & Dark Only)**:
   - Modern mode exposes only two dedicated palettes: **Light** and **Dark**, configured directly under `:root[data-ui-style="modern"]` and `:root[data-ui-style="modern"].dark`.
   - The 10 bespoke paper stationery themes are strictly reserved for Paper Mode. In Modern Mode, Settings hides paper theme swatches and provides a streamlined Light/Dark selector.

5. **Monochrome Palette & Clean Structural Layout Rules**:
   - **Monochrome Foundation with Accent Blue**: Modern mode enforces a pure black, white, and cool-gray palette with a single primary accent blue (`#1677FF` light / `#4D94FF` dark). High specificity overrides all paper theme variables, preventing any beige or green tint leakage.
     - *Light*: Canvas `#F3F4F6`, Sheet/Card `#FFFFFF` (`rgba(255, 255, 255, 0.92)`), Sunken `#EBEDF0`, Inks `#111318` / `#5A606E` / `#8C93A3`, Hairline `rgba(17, 19, 24, 0.06)`.
     - *Dark*: Canvas `#090A0D`, Sheet/Card `#18191E`, Sunken `#24262E`, Inks `#F5F6F8` / `#9BA1B0` / `#666C7A`, Hairline `rgba(255, 255, 255, 0.08)`.
   - **Borderless Cards & Zero Double-Nested Borders**:
     - Surface cards (`.paper-card`, `.paper-summary-card`) use borderless geometry (`border: none !important; border-radius: 20px-24px; box-shadow: var(--shadow-sm);`).
     - Outer rectangular card frames around segmented toggles (`SegToggle`) are eliminated (native iOS style).
     - Ledger groups render as single borderless `rounded-[22px]` cards; rows inside remain transparent and are demarcated by subtle solid hairlines (`border-b border-(--rule-hairline)` with `last:border-b-0`), preventing nested grey bubbles.
   - **Receipt Dashed-Line Ban**: In Modern Mode, a global CSS reset transforms all `.border-dashed` and `.border-dotted` into clean solid hairlines (`border-style: solid !important;`).
   - **Keypad & Modal Geometry**: Keypads sit on a sunken tray (`gap: 8px`) with rounded keys (`--keypad-radius: 16px`); category selectors use a borderless 4x2 grid; metadata controls render as cool-gray pill tags (`--btn-radius: 9999px`).
   - **Subpage Navigation Visibility**: Bottom navigation (`BottomNav` / `LiquidGlassDock`) is strictly hidden and unmounted when subpages (`SettingsSubPage`, `ImportSubPage`, `AccountDetailSubPage`) are open.

### 4.3 Pure WebGL Liquid Glass Dock (`src/components/ui/liquid-glass/`)
1. **WebGL Rendering Pipeline**:
   - When `uiStyle === 'modern'`, `BottomNav` mounts `LiquidGlassDock`, a self-contained WebGL canvas rendering a physical liquid lens over the navigation tabs without external UI dependencies.
2. **Signed Distance Field (SDF) Lens Shader**:
   - Fragment shader calculates an exact 2D rounded-capsule SDF lens. Normal vectors derived from spatial SDF gradients refract incoming light with authentic physical chromatic dispersion (separate R/G/B index of refraction offsets).
   - Specular highlights compute Fresnel edge glints and an inner reflection rim. In resting state, dispersion and chromatic aberration gracefully subside for pristine visual legibility.
3. **Dual-Texture Sampling**:
   - An offscreen 2D canvas draws two high-DPI layers: an inactive icon/label layer and an active highlighted layer (accent blue `#1677ff`).
   - The shader smoothly blends between inactive and active textures based on the lens cursor focus position, delivering fluid transmissive illumination.
4. **Damped Harmonic Spring Physics**:
   - Pointer interactions (drag, glide, click) drive a 2nd-order critically damped harmonic spring (`useLiquidSpring`). Velocity transfers seamlessly upon touch release to simulate authentic fluid mass and surface tension.
5. **Lifecycle & Resource Cleanup**:
   - WebGL context loss is explicitly triggered on unmount via the `WEBGL_lose_context` extension, safely releasing GPU textures, shaders, buffers, and animation frames.

---

## 5. Micro-Kernel Plugin System (`src/plugin-sdk/`)

HamsterStash features an extensible micro-kernel architecture where feature modules can be developed as isolated plugins:

1. **Strict SDK Boundary**:
   - Modules in `src/plugins/**` must only import from `src/plugin-sdk` or relative paths inside their own module directory.
   - Direct imports into `src/stores/`, `src/core/`, `src/domain/`, or `src/components/` are strictly banned.
2. **Extension Slots & Overrides**:
   - UI insertion points via `<PluginSlot name="..." context={...} />`.
   - Component override points via `<PluginOverride point="..." fallback={...} props={...} />`.
   - Top-level dynamic navigation registration via `ctx.ui.registerNavTab(...)`.
3. **Pipeline Middleware**:
   - Business actions (`transaction:record`, `transaction:update`, `transaction:delete`, `account:netWorth`) pass through onion-model middleware pipelines (`ctx.middleware.use`).
4. **Zero-Migration Storage**:
   - Plugins persist custom documents inside generic `plugin_data` and key-value settings in `plugin_settings`.
   - Transaction records store arbitrary plugin metadata inside `tx.ext?: Record<string, unknown>`.
5. **Owned Items Reference Plugin**:
   - Pinned as a dedicated primary navigation tab (`Owned Items`).
   - Allows linking purchases, accessories/maintenance, and second-hand resale to calculate net holding cost, daily holding cost, and depreciation rate.

---

## 6. Financial Domain & AA Offset Accounting

1. **Cents Precision**:
   - All monetary amounts are stored and calculated as positive integers representing cents (1 Yuan = 100 Cents). Fractional units are only converted at display time.
2. **AA Bill-Splitting & Expense Offsetting**:
   - Reimbursements and AA split collections are not true personal income. They link to original expenses via `offsetTransactionId`.
   - **Income Filtering**: Total income strictly excludes transactions carrying an `offsetTransactionId`.
   - **Net Expense Deduction**: The effective expense amount equals `Math.max(0, originalAmount - sumOfLinkedOffsetIncomes)`.
   - **Cross-Period Integrity**: An application-wide `offsetMap` guarantees that delayed reimbursements in later months accurately reduce net expenses.
   - Deleting an original expense automatically clears `offsetTransactionId` on linked records to prevent dangling references.

---

## 7. Engineering Quality & Code Rules

### 7.1 Self-Documenting Code & Comment Policy
- **Comments are banned by default**: Code must express intent through descriptive naming, small pure functions, and tests.
- **Strictly Banned**:
  - Narrative section banners (`// ====`, `// Keypad Handlers`, `// Submit transaction`).
  - Redundant explanatory comments on functions, interfaces, or variables.
  - JSX block annotations (`{/* Header */}`, `{/* Container */}`).
- **Allowed Exceptions**:
  - Complex mathematical boundaries or precision algorithms.
  - Browser/platform bug workarounds.
  - TypeScript triple-slash directives (`/// <reference ... />`).

### 7.2 TypeScript & Linting Discipline
- TypeScript strict mode enabled: zero `any` allowed (use `unknown` or specific generics).
- ESLint: Zero errors, zero warnings. Run `pnpm lint` and resolve every report.
- Tailwind CSS: Always use canonical class names (e.g., `stroke-2` instead of `stroke-[2]`).
- Zero backward-compatibility shims inside domain or UI components. Version upgrades must use standalone migration modules under `src/core/db/`.

---

## 8. Autonomous Atomic Git Workflow

To maintain an unblemished repository history and rapid delivery cadence:

1. **Package Manager Invariant**:
   - Always execute commands using `pnpm` or `pnpm dlx`. Never invoke `npm`, `npx`, or `yarn`.
2. **Atomic Task Units**:
   - Decompose work into discrete, cohesive increments (domain/types, UI, plugin, tests, documentation).
3. **Immediate Push Requirement**:
   - As soon as an increment passes `pnpm check`, immediately run `git add`, `git commit`, and `git push` without waiting for user prompting.
4. **Commit Message Format**:
   - Format: `<scope>: <imperative English summary>`
   - Allowed scopes: `ledger`, `stats`, `assets`, `plugin-sdk`, `plugin/items`, `ui`, `test`, `docs`, `ci`, `chore`.
   - Example: `feat(ledger): add offset transaction link pill`
5. **Verified Section in Commit Body**:
   - Whenever a commit touches more than 3 files or more than 150 lines, include a `Verified:` section in the commit body listing commands executed and test scenarios covered.
6. **Hard Quality Gate**:
   - Every commit must pass `pnpm check` (`pnpm lint && pnpm test && pnpm build`).
