# CLAUDE.md - Coding Standards for MolWeight Pro

**Version:** 1.1.0
**Last Updated:** 2025-12-31
**Enforcement Level:** Strict

---

## Table of Contents
- [Overview](#overview)
- [Project Stack](#project-stack)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Code Structure](#code-structure)
- [Comments & Documentation](#comments--documentation)
- [TypeScript Standards](#typescript-standards)
- [React & Next.js Patterns](#react--nextjs-patterns)
- [State Management (Zustand)](#state-management-zustand)
- [Styling with Tailwind CSS](#styling-with-tailwind-css)
- [Error Handling](#error-handling)
- [API & External Services](#api--external-services)
- [Testing Requirements](#testing-requirements)
- [Git Workflow](#git-workflow)
- [Code Examples](#code-examples)

---

## Overview

This document defines the **strict coding standards** for MolWeight Pro. All code contributions must adhere to these rules to ensure consistency, maintainability, and scientific accuracy.

**Core Principles:**
1. **Type Safety First** - TypeScript strict mode is mandatory
2. **Scientific Accuracy** - Calculations must be precise and well-tested
3. **Performance** - Optimize for fast calculations and smooth UI
4. **Accessibility** - Support keyboard navigation and screen readers
5. **Mobile-First** - Responsive design is non-negotiable
6. **No Emojis** - Code and documentation must be emoji-free for professionalism

---

## Project Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.x | App Router, SSR, routing |
| **React** | 19.x | UI components |
| **TypeScript** | 5.x | Type safety |
| **Zustand** | 5.x | State management |
| **Tailwind CSS** | 4.x | Styling |
| **Framer Motion** | 12.x | Animations |
| **Lucide React** | Latest | Icons |

---

## File Organization

### Directory Structure

```
src/
├── app/                    # Next.js App Router (pages, layouts)
│   ├── page.tsx           # Main entry point
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── calculators/       # Calculator-specific components
│   │   ├── MWCalculator.tsx
│   │   ├── DilutionCalculator.tsx
│   │   ├── BufferBuilder.tsx
│   │   ├── BufferCalculator.tsx
│   │   └── MolarityCalculator.tsx
│   └── ui/                # Reusable UI components
│       ├── FormulaBadge.tsx
│       ├── HistoryPanel.tsx
│       ├── RecipeLibrary.tsx
│       └── SettingsModal.tsx
├── lib/                   # Core logic, utilities
│   ├── parser.ts         # Chemical formula parser
│   ├── api.ts            # PubChem API client
│   ├── recipes.ts        # Buffer recipe definitions
│   ├── constants.ts      # Periodic table, units
│   └── utils.ts          # Generic utilities
└── store/
    └── useStore.ts       # Global Zustand store
```

### File Placement Rules

| File Type | Location | Example |
|-----------|----------|---------|
| Calculator components | `components/calculators/` | `MWCalculator.tsx` |
| Reusable UI components | `components/ui/` | `FormulaBadge.tsx` |
| Business logic | `lib/` | `parser.ts` |
| Type definitions | Co-located with implementation | `parser.ts` exports types |
| State management | `store/` | `useStore.ts` |
| Pages | `app/` | `page.tsx` |

**Rules:**
- ✅ **DO** place feature-specific components in `calculators/`
- ✅ **DO** place generic, reusable UI in `ui/`
- ✅ **DO** keep business logic separate from components in `lib/`
- ❌ **DON'T** mix UI and logic in the same file
- ❌ **DON'T** create deeply nested folders (max 3 levels)

---

## Naming Conventions

### Files & Folders

```typescript
// Components: PascalCase
MWCalculator.tsx
FormulaBadge.tsx

// Utilities/Logic: camelCase
parser.ts
api.ts
utils.ts

// Hooks: camelCase with "use" prefix
useStore.ts
useFormula.ts  // if custom hooks are added

// Constants: camelCase
constants.ts
recipes.ts

// Folders: lowercase or camelCase
calculators/
ui/
lib/
```

### Variables & Functions

```typescript
// Variables: camelCase
const mwInput = "H2O";
const bufferVolume = 100;

// Constants: SCREAMING_SNAKE_CASE
const PTABLE = { ... };
const DEFAULT_RECIPES = [ ... ];

// Functions: camelCase, verb-first
function parseFormula(formula: string): Composition { ... }
function calculateMw(composition: Composition): number { ... }
async function lookupPubChem(query: string): Promise<ChemicalData> { ... }

// React Components: PascalCase
function MWCalculator() { ... }
export default function BufferBuilder() { ... }

// Event Handlers: handle* prefix
const handleCalculate = async (e?: React.FormEvent) => { ... }
const handleSubmit = () => { ... }
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

// Boolean variables: is/has/can prefix
const isLoading = false;
const hasError = true;
const canSubmit = !loading;
```

### Interfaces & Types

```typescript
// Interfaces: PascalCase
interface ChemicalData {
    mw: number;
    formula: string;
    name?: string;
}

// Types: PascalCase
type Composition = Record<string, number>;
type TabType = "home" | "mw" | "dilution" | "buffer_calc" | "buffer_recipe" | "molarity";

// Props: Component name + "Props"
interface MWCalculatorProps {
    initialValue?: string;
}
```

---

## Code Structure

### Import Ordering

**Strict Order:**
1. React & Next.js imports
2. Third-party libraries (alphabetical)
3. Internal components (absolute imports)
4. Internal utilities/lib (absolute imports)
5. Store imports
6. Types (if not inline)
7. Styles (if any)

```typescript
// ✅ GOOD
"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { parseFormula, calculateMw } from "@/lib/parser";
import { lookupPubChem } from "@/lib/api";
import { FormulaBadge } from "@/components/ui/FormulaBadge";
import type { ChemicalData } from "@/lib/parser";

// ❌ BAD - Unordered, mixed imports
import { FormulaBadge } from "@/components/ui/FormulaBadge";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Loader2 } from "lucide-react";
```

### File Length & Complexity

| Metric | Limit | Rationale |
|--------|-------|-----------|
| File length | 300 lines | Promotes modularity |
| Function length | 50 lines | Improves readability |
| Function parameters | 4 max | Use objects for more |
| Cyclomatic complexity | 10 max | Easier testing |
| Nesting depth | 3 levels max | Reduces cognitive load |

**Exception:** Configuration files like `constants.ts` or `recipes.ts` can exceed 300 lines.

---

## Comments & Documentation

**Philosophy:** Code should be self-documenting through clear naming, but comments are **mandatory** for explaining *why* and *how* complex logic works. All public functions and non-trivial logic must be documented.

### File Headers

**Every file** must start with a file header (except Next.js pages):

```typescript
/**
 * @file parser.ts
 * @description Chemical formula parsing engine with support for nested groups,
 * hydrates, and complex formulas. Implements recursive descent parsing.
 * @module lib/parser
 * @version 1.0.0
 * @since 2025-01-01
 */

import { PTABLE } from "./constants";
// ... rest of file
```

**Template:**
```typescript
/**
 * @file <filename>
 * @description <One-line description of file purpose>
 * @module <path from src/>
 * @version <version number>
 * @since <date created>
 */
```

**Exception:** Skip file headers for simple UI components (e.g., `FormulaBadge.tsx`).

---

### Function Documentation (JSDoc)

**All exported functions** and **complex internal functions** must have JSDoc comments.

#### Standard Format (Required)

```typescript
/**
 * Parses a chemical formula into its elemental composition.
 * Supports standard notation including parentheses (), brackets [],
 * and hydrate notation using dots (·, *, .).
 *
 * @param {string} formula - Chemical formula (e.g., "H2O", "CuSO4·5H2O")
 * @returns {Composition} Object mapping element symbols to atom counts
 * @throws {Error} If formula contains invalid syntax or unknown elements
 *
 * @example
 * parseFormula("H2O")
 * // Returns: { "H": 2, "O": 1 }
 *
 * @example
 * parseFormula("Ca(OH)2")
 * // Returns: { "Ca": 1, "O": 2, "H": 2 }
 *
 * @see calculateMw for computing molecular weight from composition
 * @since 1.0.0
 */
export function parseFormula(formula: string): Composition {
    // Implementation...
}
```

#### JSDoc Tags (Mandatory)

| Tag | When to Use | Example |
|-----|-------------|---------|
| `@param` | Every parameter | `@param {string} formula - The chemical formula` |
| `@returns` | Non-void functions | `@returns {number} Molecular weight in g/mol` |
| `@throws` | Function can throw | `@throws {Error} If element is unknown` |
| `@example` | Complex functions | `@example parseFormula("H2O")` |
| `@description` | Optional extra detail | `@description Implements recursive descent parser` |
| `@see` | Related functions | `@see calculateMw` |
| `@since` | Public API functions | `@since 1.0.0` |
| `@deprecated` | Deprecated functions | `@deprecated Use parseFormulaV2 instead` |

---

### React Component Documentation

```typescript
/**
 * Molecular Weight Calculator Component
 *
 * Allows users to calculate molecular weights by entering chemical formulas
 * or common names. Attempts local parsing first, then falls back to PubChem API.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.initialValue] - Optional initial input value
 * @param {Function} [props.onResult] - Callback when calculation completes
 *
 * @returns {JSX.Element} Calculator UI with input, button, and result display
 *
 * @example
 * <MWCalculator initialValue="H2O" />
 *
 * @since 1.0.0
 */
export default function MWCalculator({ initialValue, onResult }: MWCalculatorProps) {
    // Implementation...
}
```

**Required for:**
- ✅ All exported calculator components
- ✅ Reusable UI components with props
- ❌ Simple presentational components without logic

---

### Inline Comments

#### When to Use Inline Comments

**✅ DO comment:**
- Complex algorithms or calculations
- Non-obvious business logic
- Workarounds for bugs/limitations
- Performance optimizations
- Edge case handling
- Regex patterns

**❌ DON'T comment:**
- Obvious code (`i++` doesn't need `// increment i`)
- Self-explanatory function calls
- Simple variable assignments

**❌ NEVER use emojis:**
- No emojis in comments, documentation, or code
- No emojis in commit messages (except Co-Authored-By footer)
- No emojis in variable names, function names, or strings
- Professional tone maintained throughout

#### Style Guide

```typescript
// ✅ GOOD - Explains WHY and complex logic
export function parseFormula(formula: string): Composition {
    // Split by dot notation to handle hydrates (e.g., "CuSO4·5H2O")
    // Supports multiple separators: · (middot), * (asterisk), . (period)
    const parts = formula.replace(/[·*•]/g, ".").split(".");
    const totalComp: Composition = {};

    parts.forEach((part) => {
        // Check for leading multiplier (e.g., "5H2O" in hydrates)
        // Match: digits followed by non-empty, non-digit string
        const multMatch = part.match(/^(\d+)(.*)$/);
        let multiplier = 1;
        let formulaPart = part;

        if (multMatch && multMatch[2].length > 0 && !/^\d+$/.test(multMatch[2])) {
            multiplier = parseInt(multMatch[1]);
            formulaPart = multMatch[2];
        }

        // Tokenize formula into elements, numbers, and grouping symbols
        // Regex: Capital letter + optional lowercase, OR digits, OR brackets/parens
        const tokens = formulaPart.match(/([A-Z][a-z]?|\d+|\(|\)|\[|\])/g);

        // ... rest of implementation
    });

    return totalComp;
}

// ❌ BAD - States the obvious
const parts = formula.split(".");  // Split the formula by period
const totalComp = {};              // Create empty object
```

#### Complex Calculations

```typescript
/**
 * Converts concentration from one unit to another.
 * Handles molar units (M, mM, μM) and mass-based units (g/L, mg/mL, %).
 */
function convertConcentration(value: number, fromUnit: string, toUnit: string, mw: number): number {
    // Step 1: Convert to base unit (Molar)
    let molar: number;

    switch (fromUnit) {
        case "M":
            molar = value;
            break;
        case "mM":
            molar = value * 1e-3;  // 1 mM = 0.001 M
            break;
        case "μM":
            molar = value * 1e-6;  // 1 μM = 0.000001 M
            break;
        case "g/L":
            // Convert g/L to M: (g/L) / (g/mol) = mol/L = M
            molar = value / mw;
            break;
        case "mg/mL":
            // mg/mL = g/L (1 mg/mL = 1000 mg/L = 1 g/L)
            molar = value / mw;
            break;
        case "%":
            // % w/v = g/100mL = 10 g/L
            molar = (value * 10) / mw;
            break;
        default:
            throw new Error(`Unknown concentration unit: ${fromUnit}`);
    }

    // Step 2: Convert from base unit to target unit
    // (Inverse of above conversions)
    switch (toUnit) {
        case "M":
            return molar;
        case "mM":
            return molar * 1e3;
        case "μM":
            return molar * 1e6;
        case "g/L":
            return molar * mw;
        case "mg/mL":
            return molar * mw;
        case "%":
            return (molar * mw) / 10;
        default:
            throw new Error(`Unknown concentration unit: ${toUnit}`);
    }
}
```

---

### Type Definitions & Interfaces

```typescript
/**
 * Represents a chemical compound with calculated properties.
 *
 * @interface ChemicalData
 * @property {number} mw - Molecular weight in g/mol
 * @property {string} formula - Canonical chemical formula (e.g., "H2O")
 * @property {string} [name] - Common name (optional, from PubChem)
 * @property {Composition} composition - Elemental composition as symbol->count map
 * @property {number} [cid] - PubChem Compound ID (optional)
 * @property {string[]} [synonyms] - Alternative names (future feature)
 *
 * @example
 * const water: ChemicalData = {
 *   mw: 18.015,
 *   formula: "H2O",
 *   name: "Water",
 *   composition: { "H": 2, "O": 1 },
 *   cid: 962
 * }
 */
export interface ChemicalData {
    mw: number;
    formula: string;
    name?: string;
    composition: Composition;
    cid?: number;
    synonyms?: string[];
}

/**
 * Map of element symbols to atom counts.
 *
 * @typedef {Record<string, number>} Composition
 * @example
 * const comp: Composition = { "H": 2, "O": 1 };  // H2O
 */
export type Composition = Record<string, number>;
```

---

### Constants & Configuration

```typescript
/**
 * Periodic Table of Elements
 *
 * Maps element symbols to atomic weights in g/mol.
 * Data source: IUPAC 2021 standard atomic weights.
 *
 * @constant
 * @type {Record<string, number>}
 * @see https://iupac.org/what-we-do/periodic-table-of-elements/
 */
export const PTABLE: Record<string, number> = {
    "H": 1.008,      // Hydrogen
    "He": 4.003,     // Helium
    "Li": 6.941,     // Lithium
    "Be": 9.012,     // Beryllium
    "B": 10.81,      // Boron
    "C": 12.011,     // Carbon
    // ... rest of table
};

/**
 * Supported concentration units with display labels.
 *
 * @constant
 * @type {Record<string, string>}
 */
export const UNIT_LABELS: Record<string, string> = {
    "M": "M (Molar)",
    "mM": "mM (Millimolar)",
    "μM": "μM (Micromolar)",
    // ...
};
```

---

### TODO Comments

**Format:** `TODO(author): Description [PRIORITY] [TICKET]`

```typescript
// TODO(john): Implement caching for PubChem API responses [HIGH] [ISSUE-42]
// TODO(sarah): Add support for isotopes (e.g., D2O, C13) [LOW]
// TODO: Refactor to use async parser for large formulas [MEDIUM]

// FIXME(john): Parser fails on nested brackets [[Fe(CN)6]] [CRITICAL] [BUG-15]
// FIXME: Memory leak in history panel when > 1000 entries

// HACK: Workaround for Safari backdrop-blur bug
// Remove when Safari 18+ reaches 95% adoption
const isFirefox = typeof (window as any).InstallTrigger !== 'undefined';

// NOTE: This regex intentionally allows invalid formulas to fall through
// to PubChem API for better UX (e.g., "aspirin" looks like invalid formula)
const formulaPattern = /^[A-Za-z0-9()\[\]·*•.]+$/;
```

**Priorities:**
- `[CRITICAL]` - Blocks release, must fix immediately
- `[HIGH]` - Important, fix within sprint
- `[MEDIUM]` - Should do, plan for next sprint
- `[LOW]` - Nice to have, backlog

---

### API & Network Calls

```typescript
/**
 * Queries PubChem database for chemical information by name.
 *
 * Attempts to fetch molecular formula, weight, and compound ID from
 * PubChem's PUG REST API. Returns null on failure (network error,
 * compound not found) rather than throwing.
 *
 * @async
 * @param {string} query - Chemical name or identifier (e.g., "aspirin", "ethanol")
 * @returns {Promise<ChemicalData | null>} Chemical data or null if not found
 *
 * @example
 * const aspirin = await lookupPubChem("aspirin");
 * // Returns: { mw: 180.16, formula: "C9H8O4", name: "aspirin", cid: 2244, ... }
 *
 * @example
 * const unknown = await lookupPubChem("xyzInvalidName");
 * // Returns: null
 *
 * @throws Never throws - returns null on all errors
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * @since 1.0.0
 */
export async function lookupPubChem(query: string): Promise<ChemicalData | null> {
    try {
        // Encode query to handle special characters (e.g., "α-glucose")
        const encodedQuery = encodeURIComponent(query);

        const res = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodedQuery}/property/MolecularFormula,MolecularWeight/JSON`
        );

        // 404 = compound not found, not an error condition
        if (!res.ok) {
            console.warn(`PubChem: "${query}" not found (HTTP ${res.status})`);
            return null;
        }

        const data = await res.json();
        // ... process data
    } catch (error) {
        // Log for debugging but return null for graceful degradation
        console.error("PubChem API error:", error);
        return null;
    }
}
```

---

### React Hooks & Event Handlers

```typescript
/**
 * Handles form submission for molecular weight calculation.
 *
 * Flow:
 * 1. Validates input is non-empty
 * 2. Attempts local formula parsing
 * 3. Falls back to PubChem API if local parsing fails
 * 4. Updates store with result and adds to history
 * 5. Displays user-friendly error on failure
 *
 * @async
 * @param {React.FormEvent} [e] - Optional form event (for preventDefault)
 * @returns {Promise<void>}
 *
 * @example
 * <form onSubmit={handleCalculate}>
 */
const handleCalculate = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Early return for empty input
    if (!mwInput.trim()) return;

    setLoading(true);
    setError(null);  // Clear previous errors

    try {
        // Attempt 1: Local parsing (fast, offline-capable)
        if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(mwInput) && /[A-Z]/.test(mwInput)) {
            try {
                const comp = parseFormula(mwInput);
                const mw = calculateMw(comp);
                const result = { mw, formula: mwInput, composition: comp };
                setMwResult(result);
                addToHistory(result);
                return;  // Success, exit early
            } catch (e) {
                // Local parse failed, continue to PubChem
            }
        }

        // Attempt 2: PubChem API (slower, requires network)
        const res = await lookupPubChem(mwInput);
        if (res) {
            setMwResult(res);
            addToHistory(res);
        } else {
            setError("Could not find chemical. Try a formula like 'H2O'.");
        }
    } catch (err) {
        setError("An error occurred during calculation.");
        console.error("Calculation error:", err);
    } finally {
        setLoading(false);
    }
};
```

---

### Comment Placement Examples

#### ✅ GOOD Examples

```typescript
// Example 1: Complex algorithm
export function parseFormula(formula: string): Composition {
    /**
     * Parsing Strategy:
     * 1. Split by dots to handle hydrates (e.g., "CuSO4·5H2O")
     * 2. For each part, check for leading multiplier
     * 3. Tokenize into elements, numbers, brackets
     * 4. Use stack-based parsing for nested groups
     * 5. Aggregate all parts into final composition
     */

    // Replace all dot variants with standard period for consistent splitting
    const parts = formula.replace(/[·*•]/g, ".").split(".");

    // ... implementation
}

// Example 2: Edge case handling
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string for clearing input
    if (value === "") {
        setMwInput("");
        return;
    }

    // Sanitize: Remove leading/trailing whitespace but preserve internal spaces
    // (e.g., "calcium chloride" should remain valid)
    const sanitized = value.trim();
    setMwInput(sanitized);
};

// Example 3: Performance optimization
const formatFormula = useMemo(() => {
    // Memoize expensive subscript rendering to avoid recalculation
    // on every render. Only recompute when formula string changes.
    return formula.replace(/(\d+)/g, '<sub>$1</sub>');
}, [formula]);

// Example 4: Workaround documentation
// HACK: Safari 17.x has a bug with backdrop-blur on dynamic elements
// Force GPU acceleration with transform3d to prevent blur artifacts
const glassPanelStyle = {
    backdropFilter: "blur(12px)",
    transform: "translate3d(0, 0, 0)",  // GPU layer hack
};
```

#### ❌ BAD Examples

```typescript
// BAD: Obvious code
const sum = a + b;  // Add a and b
const isValid = true;  // Set isValid to true

// BAD: Redundant comments
// Calculate molecular weight
const mw = calculateMw(composition);

// BAD: Outdated comments (code changed but comment didn't)
// Returns array of recipes
function getRecipeById(id: string): Recipe {  // Now returns single recipe!
    // ...
}

// BAD: Commented-out code (use git instead!)
// const oldParser = (formula) => {
//     // ... 50 lines of old code
// };

// BAD: Vague TODO
// TODO: Fix this
// TODO: Make better
```

---

### Documentation Coverage Requirements

| Code Type | Documentation Required | Enforcement |
|-----------|------------------------|-------------|
| Exported functions | ✅ Full JSDoc | Mandatory |
| Public components | ✅ Full JSDoc | Mandatory |
| Internal functions (>20 lines) | ✅ Description + params | Mandatory |
| Internal functions (<20 lines) | ⚠️ Optional | Recommended |
| Complex algorithms | ✅ Inline comments | Mandatory |
| Type definitions | ✅ Property descriptions | Mandatory |
| Constants | ✅ Description + source | Mandatory |
| Event handlers | ⚠️ Brief description | Recommended |
| Simple getters/setters | ❌ Not needed | Optional |

---

### Pre-Commit Documentation Checklist

Before committing, verify:

- [ ] All exported functions have JSDoc headers
- [ ] All parameters documented with `@param`
- [ ] Return types documented with `@returns`
- [ ] Exceptions documented with `@throws`
- [ ] Complex logic has inline comments explaining WHY
- [ ] No commented-out code blocks
- [ ] No obvious/redundant comments
- [ ] File header present (if applicable)
- [ ] TODOs include priority and author
- [ ] Examples provided for non-trivial functions

---

## TypeScript Standards

### Type Safety

```typescript
// ✅ GOOD - Explicit types
function calculateMw(composition: Composition): number {
    return Object.entries(composition).reduce(
        (sum, [symbol, count]) => sum + PTABLE[symbol] * count,
        0
    );
}

// ❌ BAD - Implicit any
function calculate(comp) {  // comp is 'any'
    return Object.entries(comp).reduce(...);
}
```

### Interface vs Type

**Use `interface` for:**
- Object shapes
- Extending other interfaces
- Public APIs

**Use `type` for:**
- Union types
- Intersection types
- Mapped types
- Function signatures

```typescript
// ✅ Interfaces for objects
interface ChemicalData {
    mw: number;
    formula: string;
    name?: string;
    composition: Composition;
}

// ✅ Types for unions
type TabType = "home" | "mw" | "dilution" | "buffer_calc";
type UnitType = "M" | "mM" | "μM" | "g/L" | "mg/mL";

// ✅ Types for records
type Composition = Record<string, number>;
```

### Optional vs Required

```typescript
// ✅ GOOD - Clear optionality
interface ChemicalData {
    mw: number;              // Required: Always present
    formula: string;         // Required: Always present
    name?: string;           // Optional: Only from PubChem
    cid?: number;            // Optional: Only from PubChem
    composition: Composition; // Required: Calculated
}

// ❌ BAD - Everything optional
interface ChemicalData {
    mw?: number;
    formula?: string;
    name?: string;
}
```

### Type Assertions - Use Sparingly

```typescript
// ❌ AVOID - Type assertions hide issues
setMwResult(result as any);

// ✅ BETTER - Proper typing
const result: ChemicalData = {
    mw: Number(res.mw),
    formula: String(res.formula),
    name: res.name ? String(res.name) : undefined,
    cid: res.cid ? Number(res.cid) : undefined,
    composition: comp
};
setMwResult(result);
```

---

## React & Next.js Patterns

### Component Structure

**Standard Order:**
1. "use client" directive (if needed)
2. Imports
3. Type definitions (if component-specific)
4. Component function
5. Return JSX

```typescript
"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";

interface MWCalculatorProps {
    initialValue?: string;
}

export default function MWCalculator({ initialValue }: MWCalculatorProps) {
    // 1. Hooks (useState, useEffect, custom hooks)
    const [loading, setLoading] = useState(false);
    const { mwInput, setMwInput } = useStore();

    // 2. Event handlers
    const handleCalculate = async () => {
        // ...
    };

    // 3. Derived state
    const canSubmit = !loading && mwInput.trim().length > 0;

    // 4. Effects
    useEffect(() => {
        // ...
    }, []);

    // 5. Return JSX
    return (
        <div>
            {/* ... */}
        </div>
    );
}
```

### Client vs Server Components

```typescript
// ✅ Client Component - Uses hooks, event handlers
"use client";

export default function MWCalculator() {
    const [loading, setLoading] = useState(false);
    // ...
}

// ✅ Server Component - No "use client", no hooks
export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html>
            <body>{children}</body>
        </html>
    );
}
```

### Async Patterns - Use async/await

```typescript
// ✅ GOOD - async/await
const handleCalculate = async () => {
    setLoading(true);
    try {
        const result = await lookupPubChem(query);
        setMwResult(result);
    } catch (err) {
        setError("An error occurred");
    } finally {
        setLoading(false);
    }
};

// ❌ BAD - Promise chains
const handleCalculate = () => {
    lookupPubChem(query)
        .then(result => setMwResult(result))
        .catch(err => setError("Error"))
        .finally(() => setLoading(false));
};
```

---

## State Management (Zustand)

### Store Structure

**Rules:**
1. Single global store (`useStore`)
2. Slice pattern for organization
3. Actions co-located with state
4. Persist only necessary data

```typescript
// ✅ GOOD - Organized slices
interface AppState {
    // MW Calculator Slice
    mwInput: string;
    setMwInput: (val: string) => void;
    mwResult: ChemicalData | null;
    setMwResult: (data: ChemicalData | null) => void;

    // Dilution Slice
    dilution: {
        name: string;
        mw: number;
        c1: string;
        // ...
    };
    setDilution: (data: Partial<AppState["dilution"]>) => void;

    // Actions
    resetStore: () => void;
}
```

### Accessing Store

```typescript
// ✅ GOOD - Selective subscription
const { mwInput, setMwInput } = useStore();

// ❌ BAD - Subscribe to entire store
const store = useStore();
store.mwInput;
```

### Persistence

```typescript
// ✅ GOOD - Partial persistence
partialize: (state) => {
    const {
        isHistoryOpen, isSettingsOpen,  // Don't persist UI state
        isRecipeLibraryOpen, isSaveRecipeOpen,
        ...rest
    } = state;
    return rest;
}
```

---

## Styling with Tailwind CSS

### Class Organization

**Order:** Layout → Box Model → Typography → Visual → Interactive

```tsx
// ✅ GOOD - Organized classes
<div className="
    flex flex-col items-center gap-4
    p-6 rounded-lg
    text-center text-lg font-medium
    bg-white/5 border border-white/10
    hover:bg-white/10 transition-all
">

// ❌ BAD - Random order
<div className="hover:bg-white/10 text-lg flex border p-6 gap-4 bg-white/5">
```

### Custom Classes

**Use predefined classes:**
- `glass-card` - Standard glassmorphism card
- `primary` - Primary button style

```tsx
// ✅ GOOD
<section className="glass-card">
<button className="primary">Calculate</button>

// ❌ BAD - Repeating styles
<section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
```

### Responsive Design

**Mobile-first approach:**

```tsx
// ✅ GOOD - Mobile first, then breakpoints
<div className="
    text-sm sm:text-base lg:text-lg
    p-4 sm:p-6 lg:p-8
    grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
">

// ❌ BAD - Desktop first
<div className="text-lg lg:text-sm">
```

---

## Error Handling

### Try-Catch Pattern

```typescript
// ✅ GOOD - Proper error handling
const handleCalculate = async () => {
    setLoading(true);
    setError(null);  // Clear previous errors

    try {
        const result = await lookupPubChem(query);
        setMwResult(result);
    } catch (err) {
        // Provide user-friendly message
        setError("Could not find chemical or parse formula.");
        console.error("PubChem lookup error:", err);
    } finally {
        setLoading(false);
    }
};

// ❌ BAD - Silent failures
const handleCalculate = async () => {
    try {
        const result = await lookupPubChem(query);
        setMwResult(result);
    } catch (e) {
        // Error ignored!
    }
};
```

### Validation

```typescript
// ✅ GOOD - Early return for validation
function parseFormula(formula: string): Composition {
    if (!formula || formula.trim() === "") {
        throw new Error("Formula cannot be empty");
    }

    // Main logic...
}

// ✅ GOOD - User-facing validation
const handleCalculate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!mwInput.trim()) return;  // Early return

    // Proceed with calculation...
};
```

### Error Messages

**Rules:**
- User-facing: Friendly, actionable
- Console: Detailed, with context
- Throw errors for invalid states
- Display errors inline when possible

```typescript
// ✅ GOOD - User-friendly
setError("Could not find chemical. Try entering a formula like 'H2O'.");

// ❌ BAD - Technical jargon
setError("PubChem API returned 404 status code");
```

---

## API & External Services

### PubChem API

**Standard Pattern:**

```typescript
// ✅ GOOD - Proper error handling, typing
export async function lookupPubChem(query: string): Promise<ChemicalData | null> {
    try {
        const res = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/MolecularFormula,MolecularWeight/JSON`
        );

        if (!res.ok) {
            console.warn(`PubChem API returned ${res.status} for "${query}"`);
            return null;
        }

        const data = await res.json();
        // Process and return typed data...

    } catch (error) {
        console.error("PubChem API error:", error);
        return null;
    }
}
```

**Rules:**
- ✅ Always encode user input (`encodeURIComponent`)
- ✅ Handle non-200 responses gracefully
- ✅ Return `null` on failure (not throw)
- ✅ Log errors to console
- ❌ Never expose raw API errors to users

---

## Testing Requirements

### Unit Tests (Future)

**Coverage Goals:**
- `lib/parser.ts` - 100% (critical calculations)
- `lib/api.ts` - 90%
- Components - 70%

**Test File Naming:**
```
src/lib/parser.ts       → src/lib/__tests__/parser.test.ts
src/lib/api.ts          → src/lib/__tests__/api.test.ts
```

### Manual Testing Checklist

Before committing, verify:
- [ ] Formula parser handles edge cases: `CuSO4·5H2O`, `Ca(OH)2`, `Fe2[Fe(CN)6]3`
- [ ] PubChem lookup works for common names
- [ ] Calculations are accurate (use known values)
- [ ] Responsive on mobile (375px width)
- [ ] No console errors
- [ ] State persists after refresh

---

## Git Workflow

### Branch Naming

```bash
# Features
feat/buffer-export-pdf
feat/molarity-calculator

# Fixes
fix/formula-parser-parentheses
fix/mobile-layout-overflow

# Refactoring
refactor/extract-unit-conversion

# Documentation
docs/update-readme
```

### Commit Messages

**Format:** `<type>(<scope>): <subject>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring
- `style` - Formatting, CSS changes
- `docs` - Documentation
- `test` - Adding tests
- `chore` - Maintenance

**Examples:**
```bash
feat(mw-calc): Add PubChem structure image display
fix(parser): Handle nested parentheses in formulas
refactor(store): Split buffer state into separate slice
style(ui): Update glassmorphism opacity values
docs(readme): Add installation instructions
```

**Commit Message Template:**
```
<type>(<scope>): <short summary>

<Detailed explanation if needed>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Pull Request Requirements

Before merging:
1. ✅ All manual tests pass
2. ✅ No TypeScript errors (`npm run build`)
3. ✅ No console warnings in dev mode
4. ✅ Code follows CLAUDE.md standards
5. ✅ Responsive on mobile/tablet/desktop

---

## Code Examples

### ✅ GOOD: Proper Component Structure

```typescript
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { parseFormula, calculateMw } from "@/lib/parser";
import type { ChemicalData } from "@/lib/parser";

export default function MWCalculator() {
    // 1. State & Store
    const { mwInput, setMwInput, setMwResult, addToHistory } = useStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 2. Event Handlers
    const handleCalculate = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!mwInput.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const comp = parseFormula(mwInput);
            const mw = calculateMw(comp);
            const result: ChemicalData = {
                mw,
                formula: mwInput,
                composition: comp,
            };
            setMwResult(result);
            addToHistory(result);
        } catch (err) {
            setError("Invalid formula. Try 'H2O' or 'C6H12O6'.");
        } finally {
            setLoading(false);
        }
    };

    // 3. JSX
    return (
        <form onSubmit={handleCalculate} className="glass-card space-y-4">
            <input
                type="text"
                value={mwInput}
                onChange={(e) => setMwInput(e.target.value)}
                placeholder="Enter formula..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
            />
            <button type="submit" disabled={loading} className="primary">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
    );
}
```

### ❌ BAD: Mixed Concerns, Poor Typing

```typescript
// NO "use client" directive - will fail!
import { useState } from "react";

// BAD: No types, mixed logic and UI
export default function MWCalculator() {
    const [input, setInput] = useState();  // any type!
    const [result, setResult] = useState();

    // BAD: Logic in component
    const calculate = () => {
        let mw = 0;
        // 50 lines of parsing logic here...
        setResult(mw);
    };

    // BAD: No error handling
    return <div onClick={calculate}>{result}</div>;
}
```

### ✅ GOOD: Utility Function

```typescript
// lib/utils.ts
const trim = (val: number, precision: number): string =>
    parseFloat(val.toFixed(precision)).toString();

export function formatMass(grams: number): string {
    if (grams < 1e-6) return trim(grams * 1e9, 1) + " ng";
    if (grams < 1e-3) return trim(grams * 1e6, 1) + " μg";
    if (grams < 1) return trim(grams * 1000, 1) + " mg";
    return trim(grams, 3) + " g";
}
```

### ❌ BAD: Utility Function

```typescript
// BAD: No types, unclear naming
export function format(g) {
    if (g < 0.000001) return (g * 1000000000).toFixed(1) + " ng";
    // ...
}
```

---

## Enforcement

**These standards are mandatory.** Code that doesn't comply will not be merged.

**Review Checklist:**
- [ ] TypeScript types are explicit (no `any` types)
- [ ] Imports are ordered correctly
- [ ] Functions are < 50 lines
- [ ] Error handling is present
- [ ] Naming follows conventions
- [ ] Responsive classes are mobile-first
- [ ] No console errors/warnings
- [ ] **All exported functions have JSDoc comments**
- [ ] **Function parameters and return types documented**
- [ ] **Complex logic has inline comments explaining WHY**
- [ ] **No commented-out code blocks**
- [ ] **File headers present (where applicable)**

**Questions?** Refer to existing code in `src/components/calculators/MWCalculator.tsx` as the gold standard.

---

**Document Version:** 1.1.0
**Last Updated:** 2025-12-31
**Maintained By:** Project Lead
