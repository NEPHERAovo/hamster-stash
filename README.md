# hamsterStash

> **English** | [简体中文](README.zh-CN.md)

A minimal, local-first paper stationery expense-tracking progressive web app (PWA) designed for personal and micro-business finances.

---

## Highlights

- **Crafted Stationery Design**: Delicate warm paper surfaces, authentic pulp micro-noise (`<feTurbulence>`), tactile torn-receipt deckle edges (`.paper-deckle`), washi tape tabs, and physical ink bleed stamps.
- **Per-Day Receipt Grouping**: Daily transactions grouped cleanly into cohesive paper receipt sheets with dashed hairlines, eliminating distracting ledger grid lines and clutter.
- **Notepad Bottom Sheet**: Seamless sliding drawer equipped with an integrated 4x4 desktop calculator keypad, a 3-column mechanical drum-wheel date/time picker, and stamp-block category grids.
- **AA Bill-Splitting & Expense Offsetting**: True double-entry style offset accounting. Shared expense reimbursements link directly to original expenses, preventing artificial income inflation while adjusting net consumption.
- **Local-First & Offline Privacy**: Data persists directly within browser IndexedDB via a pluggable `DataAdapter`. Fully functional without network connectivity; full JSON and CSV backup/restore supported.
- **10 Paper Stationery Themes**: 5 Light themes (Sage, Cotton, Kraft, Mist, Cherry) and 5 Dark themes (Carbon, Indigo, Espresso, Obsidian, Pine) mapped entirely through semantic CSS tokens.
- **Micro-Kernel Plugin SDK**: Extensible micro-kernel architecture (`src/plugin-sdk/`) supporting UI slot insertion, component overrides, onion middleware, and zero-migration plugin storage. Ships with a reference `Owned Items` plugin for tracking asset lifecycles and daily holding costs.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler & Tooling**: Vite + `@vite-pwa/plugin`
- **Styling**: Tailwind CSS v4 + Semantic CSS Variables
- **Icons**: Lucide React (vector line iconography only; zero emojis in UI)
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

MIT
