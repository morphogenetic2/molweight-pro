# CLAUDE.md - MolWeight Pro Codebase Status

## Snapshot

- **Snapshot date:** 2026-02-13
- **Repository:** `molweight-pro`
- **App type:** Next.js App Router SPA-style lab calculator suite (client-heavy)
- **Deployment mode:** Static export (`next.config.ts` uses `output: "export"`)
- **Primary state:** Zustand + persisted localStorage
- **Backend:** None (direct browser calls to public APIs)

## Runtime and Tooling

From `package.json`:

- `next`: `16.1.1`
- `react` / `react-dom`: `19.2.3`
- `typescript`: `^5`
- `zustand`: `^5.0.9`
- `tailwindcss`: `^4`
- `framer-motion`: `^12.23.26`
- `lucide-react`: `^0.562.0`
- `vitest`: `^2.1.5`

Scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run test`
- `npm run test:watch`

## Current Product Surface

The app currently exposes these tabs from `src/app/page.tsx`:

1. `home` (dashboard)
2. `mw` (Molecular Weight)
3. `dilution` (single-step dilution)
4. `serial_dilution`
5. `molarity`
6. `buffer_calc`
7. `buffer_recipe` (recipe builder)
8. `stocks` (stock inventory)
9. `help`

### What is implemented now

- **MW calculator**
  - Local formula parser first, PubChem fallback.
  - Hydrate-aware formula handling.
  - 2D rendering via `smiles-drawer` and optional 3D via PubChem SDF + `3Dmol` CDN.
  - History persists in store.
- **Dilution calculator**
  - C1V1=C2V2 workflow with unit conversion and cross-domain conversions (molar <-> mass concentration via MW).
  - Can push/update linked entries into recipe builder.
- **Serial dilution calculator**
  - Auto/custom modes, ratio parsing, pipette minimum quantization, protocol text/CSV export.
- **Molarity calculator**
  - Solves mass/volume/concentration with unit-aware conversion engine.
  - PubChem/local MW lookup integrated.
- **Buffer calculator**
  - Buffer systems implemented in-component (`phosphate`, `tris`, `hepes`, `acetate`, `citrate`).
  - Salt-mix and titration paths.
  - Can export computed composition into recipe builder.
- **Recipe builder**
  - Multi-solute editing, stock-aware calculations, checklist mode, save/load library, PDF export via `jspdf` + `jspdf-autotable`.
- **Stock manager**
  - Add/remove stock solutions with parsed units and optional PubChem lookup.
- **Global UX**
  - Toast notifications, modal-based settings/history/library/save flows, responsive sidebar/mobile nav.

## Architecture Overview

Top-level source layout:

- `src/app/` - layout, page shell, global styles
- `src/components/calculators/` - feature calculators
- `src/components/ui/` - reusable UI/overlays/renderers
- `src/lib/` - parser, chemistry/unit conversion, serial dilution logic, API helpers, recipes/constants
- `src/store/` - Zustand root store + slices + types

### State model

`src/store/useStore.ts` composes slices:

- `uiSlice`
- `mwSlice`
- `dilutionSlice`
- `bufferRecipeSlice`
- `bufferCalcSlice`
- `molaritySlice`
- `serialDilutionSlice`
- `recipesSlice`
- `stocksSlice`

Persistence details:

- **storage key:** `molweight-storage-v2`
- **persist version:** `4`
- includes migration logic for adjustment stocks, molecule rendering settings, and serial dilution state normalization.
- transient modal-open booleans are excluded via `partialize`.

## External Integrations

- **PubChem PUG REST API**
  - Compound lookup by name/formula
  - Property fetch (formula/MW/smiles)
  - Synonym fetch
  - 2D PNG and 3D SDF retrieval
- **3Dmol CDN**
  - Script loaded at runtime in browser for 3D rendering
- **Vercel Analytics**
  - Included in `src/app/layout.tsx`

## Testing and Quality Status (Verified in this workspace)

### Tests

Command run: `npm run test`

- Result: **pass**
- Test files: **5**
- Tests: **26 passed**

Covered modules:

- `src/lib/parser.test.ts`
- `src/lib/chemistry/units.test.ts`
- `src/lib/chemistry/converter.test.ts`
- `src/lib/chemistry/dilution.test.ts`
- `src/lib/serialDilution/planner.test.ts`

### Lint

Command run: `npm run lint`

- Result: **pass with warnings**
- Warnings: **6**
- Errors: **0**

Current warnings:

1. `src/components/calculators/BufferBuilder.tsx` - unused import (`parseFormula`)
2. `src/components/calculators/BufferBuilder.tsx` - unused import (`calculateMw`)
3. `src/components/calculators/MWCalculator.tsx` - unused state (`imageError`)
4. `src/components/calculators/MWCalculator.tsx` - `@next/next/no-img-element`
5. `src/components/ui/HelpView.tsx` - unused import (`InlineMath`)
6. `src/components/ui/Molecule2D.tsx` - missing `useEffect` dependency (`forceExplicitHydrogens`)

## Current Gaps / Inconsistencies

These are present in current code and docs/UI:

- `SettingsModal` shows `v1.0.0`, while `package.json` is `0.1.0`.
- `MolarityState.target` includes `"mw"`, but the UI only exposes solve-lock controls for `mass`, `concentration`, and `volume`; the `target === 'mw'` path is effectively not used.
- ID generation relies on `Math.random().toString(36)` across multiple slices/components.
- Test coverage is good for pure logic modules but not present for React components/interaction flows.

## Deployment Status

- `next.config.ts` uses static export and unoptimized images.
- GitHub Actions workflow exists at `.github/workflows/deploy.yml`.
- Workflow builds with Node 20 and deploys `./out` to GitHub Pages.

## Practical Coding Conventions Observed in Current Code

This reflects actual code patterns in-repo today (not aspirational rules):

- TypeScript strict mode is enabled.
- Most feature logic is colocated inside calculator components; shared computation is extracted into `src/lib/chemistry/*`, `src/lib/parser.ts`, and `src/lib/serialDilution/planner.ts`.
- Zustand slices are used for cross-tab/shared state.
- Tailwind utility classes + custom global utility classes (`glass-card`, `primary`, `secondary`) drive styling.
- JSDoc exists in many `lib/*` files but is not uniformly enforced across UI components.

## Recommended Next Maintenance Pass

1. Clear all current lint warnings and keep lint at zero warnings.
2. Align app-visible version metadata with `package.json`.
3. Decide whether `target: "mw"` should be fully supported or removed from state type.
4. Add component-level tests for key calculators and store flows.
5. Replace random ID generation with stable UUIDs.

---

This document is intended as a living status snapshot of the implemented codebase.
