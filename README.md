# HamsterStash

> **English** | [简体中文](README.zh-CN.md)

A minimal, local-first personal expense, item & asset stash progressive web app (PWA).

---

## Highlights

- **Dual-Skin System (Paper & Modern Liquid Glass)**: Switch seamlessly between tactile Paper Stationery surfaces (micro-noise, torn-receipt deckle edges, washi tape tabs, physical ink bleed stamps) and a monochrome Modern Liquid Glass dock driven by a custom WebGL lens shader.
- **Per-Day Receipt Grouping**: Daily transactions grouped cleanly into cohesive paper receipt sheets with dashed hairlines, eliminating distracting ledger grid lines and clutter.
- **Notepad Bottom Sheet**: Seamless sliding drawer equipped with an integrated 4x4 desktop calculator keypad, a calendar + 2-column mechanical drum-wheel time picker, and stamp-block category grids.
- **AA Bill-Splitting & Expense Offsetting**: True double-entry style offset accounting. Shared expense reimbursements link directly to original expenses, preventing artificial income inflation while adjusting net consumption.
- **Local-First & Pluggable 4-Layer Persistence**: Data persists locally in IndexedDB behind strict `UI / Stores -> Domain Services (DI) -> Repositories -> DataAdapter` boundaries. Offline-capable PWA with JSON/CSV backup and WebDAV sync.
- **10 Paired Paper Stationery Themes**: 5 Light themes (Sage, Cotton, Kraft, Mist, Cherry) paired 1-to-1 with 5 Dark themes (Pine, Carbon, Espresso, Indigo, Crimson) via semantic CSS tokens, plus dedicated Light/Dark palettes for Modern mode.
- **Micro-Kernel Plugin SDK**: Extensible micro-kernel architecture (`src/plugin-sdk/`) supporting UI slot insertion, component overrides, onion middleware, and zero-migration plugin storage. Ships with a reference `Owned Items` plugin for tracking asset lifecycles and daily holding costs.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler & Tooling**: Vite + `@vite-pwa/plugin`
- **Styling**: Tailwind CSS v4 + Semantic CSS Variables
- **Icons**: `@phosphor-icons/react` (vector line iconography only; zero emojis in UI)
- **State Management**: Zustand
- **Persistence**: `idb` (IndexedDB Promise wrapper)
- **Testing**: Vitest + React Testing Library

---

## Quick Start

### 1. Install Dependencies

Always use `pnpm`:

```bash
pnpm install
```

### 2. Start Development Server

```bash
pnpm dev
```

Open the displayed localhost URL (default `http://localhost:5173`) in your browser.

### 3. Verification Suite

Run our strict three-tier verification suite (ESLint + Vitest + TypeScript/Vite build):

```bash
pnpm check
```

---

## Architecture & Engineering Standards

1. **Dual-Language Boundary**:
   - **Engineering Layer (100% English)**: Documentation (`AGENTS.md`, `LESSONS.md`, `README.md`), commit messages, test descriptions, CI configurations, and technical comments are strictly written in English.
   - **Product Layer (Chinese-Dominant)**: User-facing UI labels, forms, categories, and notifications are rendered in clean, natural Chinese. Top-level serif journal headers remain in English (`Instrument Serif`).
2. **Self-Documenting Code**: Narrative section comments and redundant code explanations are strictly banned. Code must communicate intent through clear naming and tests.
3. **Strict Quality Gates**: Zero ESLint warnings, zero `any` types, and 100% test pass rate enforced via GitHub Actions CI on every commit.

---

## License

[CC BY-NC 4.0](LICENSE) — Copyright (c) 2026 [NEPHERAovo](https://github.com/NEPHERAovo/hamster-stash). Free to use, modify, and share for non-commercial purposes with attribution.
