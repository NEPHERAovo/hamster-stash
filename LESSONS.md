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
