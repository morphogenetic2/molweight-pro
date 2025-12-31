# AGENT.md - MolWeight Pro Technical Specification

**Project:** MolWeight Pro
**Version:** 1.0.0
**Status:** In Active Development
**Last Updated:** 2025-12-31

---

## Table of Contents
- [Project Overview](#project-overview)
- [Technical Architecture](#technical-architecture)
- [Core Features](#core-features)
- [Data Models](#data-models)
- [API Integration](#api-integration)
- [State Management](#state-management)
- [UI/UX Design System](#uiux-design-system)
- [Development Environment](#development-environment)
- [Deployment](#deployment)
- [Future Roadmap](#future-roadmap)

---

## Project Overview

### Problem Statement

Scientists, researchers, and chemistry students need to perform routine laboratory calculations daily:
- **Molecular weight lookups** for chemicals
- **Dilution calculations** for stock solutions
- **Buffer recipe planning** for complex solutions

Existing tools are either:
- Outdated with poor UX (1990s-era interfaces)
- Fragmented across multiple websites
- Not mobile-friendly
- Lack offline capabilities

### Solution

**MolWeight Pro** is a modern, unified web application that provides:
1. **Instant molecular weight calculation** from chemical names or formulas
2. **Dilution calculator** with multi-unit support
3. **Buffer builder** with recipe library and print-friendly output
4. **Molarity calculator** for mass/volume/concentration conversions

### Target Users

| User Type | Use Case | Frequency |
|-----------|----------|-----------|
| **Research Scientists** | Daily calculations for experiments | Multiple times/day |
| **Lab Technicians** | Buffer preparation, dilutions | Daily |
| **Students** | Homework, lab reports | Weekly |
| **Educators** | Teaching demonstrations | Weekly |

### Unique Value Proposition

1. **Modern "Glassmorphism" UI** - Professional, polished aesthetic
2. **Mobile-First Design** - Works on phone, tablet, desktop
3. **Offline-Ready** - Calculations work without internet (formulas)
4. **Persistent History** - Remember previous calculations
5. **Print-Optimized** - Clean checklist view for lab use

---

## Technical Architecture

### Tech Stack

```
┌─────────────────────────────────────────────┐
│           Frontend (Next.js 16)             │
├─────────────────────────────────────────────┤
│  React 19 + TypeScript 5 + Tailwind CSS 4  │
│  Zustand (State) + Framer Motion (Anim)    │
│  Lucide Icons + Custom Components          │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│        Business Logic (lib/)                │
├─────────────────────────────────────────────┤
│  • Formula Parser (Recursive Descent)      │
│  • Periodic Table Constants                │
│  • Unit Conversion Engine                  │
│  • Buffer Recipes Database                 │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      External APIs (Optional)               │
├─────────────────────────────────────────────┤
│  • PubChem REST API (chemical lookup)      │
│  • PNG image fetching (2D structures)      │
└─────────────────────────────────────────────┘
```

### System Architecture

```
┌──────────────┐
│  User Input  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│   Input Validation & Sanitization   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│    Is it a Formula or Name?          │
└──────┬────────────────┬──────────────┘
       │                │
   Formula?          Name?
       │                │
       ▼                ▼
┌─────────────┐   ┌─────────────┐
│Local Parser │   │  PubChem    │
│  (parser.ts)│   │  API Call   │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                ▼
      ┌──────────────────┐
      │  Calculate MW    │
      │  (calculateMw)   │
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │  Update Store    │
      │  + History       │
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │   Display Result │
      └──────────────────┘
```

### Component Hierarchy

```
App (page.tsx)
├── NavigationTabs
├── HistoryPanel (Slide-out)
├── SettingsModal
└── ActiveCalculator
    ├── MWCalculator
    │   ├── Input Field
    │   ├── PubChem Link Button
    │   ├── Calculate Button
    │   └── Result Display
    │       ├── MW Badge
    │       ├── FormulaBadge
    │       └── Structure Image
    │
    ├── DilutionCalculator
    │   ├── Stock Inputs (C1, V1)
    │   ├── Target Inputs (C2, V2)
    │   ├── Unit Selectors
    │   └── Result Display
    │
    ├── BufferBuilder
    │   ├── Total Volume Input
    │   ├── Solute List
    │   │   └── Solute Card (×N)
    │   ├── Add Solute Button
    │   ├── Recipe Library Button
    │   └── Print View Toggle
    │
    ├── BufferCalculator (simplified)
    └── MolarityCalculator
        ├── MW Input
        ├── Mass/Volume/Conc Inputs
        ├── Unit Selectors
        └── Calculation Toggle
```

---

## Core Features

### 1. Molecular Weight Calculator

**Inputs:**
- Single text field accepting:
  - Chemical formulas: `H2O`, `CuSO4·5H2O`, `Ca(OH)2`
  - Common names: `Aspirin`, `Glucose`, `Ethanol`

**Processing:**
1. **Regex Check** → Is it a formula pattern?
   - If yes → Parse locally with `parseFormula()`
   - If no → Query PubChem API
2. **Calculation** → Use periodic table to compute MW
3. **Storage** → Add to history (max 10 entries)

**Outputs:**
- Molecular Weight (g/mol) - Large, prominent display
- Canonical Formula (with subscripts via FormulaBadge)
- Chemical Name (if from PubChem)
- 2D Structure Image (if CID available)

**Edge Cases:**
| Input | Expected Behavior |
|-------|-------------------|
| Empty string | No action / error message |
| `H2O` | Parse locally → 18.015 g/mol |
| `Aspirin` | PubChem API → 180.16 g/mol |
| `XyZ123` | Error: "Could not find chemical" |
| `CuSO4.5H2O` | Parse hydrate → 249.69 g/mol |

---

### 2. Dilution Calculator

**Formula:** `C₁V₁ = C₂V₂`

**Inputs:**
- **Stock (C₁):** Concentration + Unit
- **Target (C₂):** Concentration + Unit
- **Final Volume (V₂):** Volume + Unit
- **Optional:** Solute name + MW (for mass calculations)

**Supported Units:**
```typescript
Concentration: "M" | "mM" | "μM" | "g/L" | "mg/mL" | "%" | "pct" | "dil"
Volume: "L" | "mL" | "μL"
```

**Calculation:**
```
V₁ = (C₂ × V₂) / C₁
```

**Output:**
- Required stock volume (V₁) in optimal units (auto-formatted)
- Instruction: "Add [V₁] of stock to [V₂ - V₁] of solvent"

**Validation:**
- C₁ must be > C₂ (dilution, not concentration!)
- All numeric fields must be positive
- Unit conversions must preserve molarity

---

### 3. Buffer Builder

**Purpose:** Create multi-solute buffer recipes (e.g., PBS, Tris-EDTA)

**Inputs:**
- **Total Volume** + Unit (default: 100 mL)
- **Solute List** (each with):
  - Name (string)
  - Molecular Weight (number)
  - Target Concentration (number + unit)

**Calculation (per solute):**
```
Mass (g) = (Concentration in M) × (Volume in L) × (MW in g/mol)
```

**Features:**
- ✅ Add/Remove solutes dynamically
- ✅ Load from predefined recipes (`DEFAULT_RECIPES`)
- ✅ Save custom recipes to localStorage
- ✅ Print-friendly checklist view
- ✅ Interactive checkboxes (even in print mode)

**Predefined Recipes:**
- 10× PBS
- 1× TAE Buffer
- 1× TE Buffer
- Lysis Buffer (RIPA)

---

### 4. Molarity Calculator

**Purpose:** Convert between mass, volume, concentration, and MW

**Formula:**
```
Molarity (M) = Mass (g) / (MW (g/mol) × Volume (L))
```

**Modes:**
- Solve for **Mass** (given M, V, MW)
- Solve for **Volume** (given M, mass, MW)
- Solve for **Concentration** (given mass, V, MW)
- Solve for **MW** (given mass, V, M)

**Units:**
```typescript
Mass: "g" | "mg" | "μg"
Volume: "L" | "mL" | "μL"
Concentration: "M" | "mM" | "μM"
```

---

## Data Models

### Core Types

```typescript
// Chemical Data (from MW Calculator)
interface ChemicalData {
    mw: number;              // Molecular weight (g/mol)
    formula: string;         // Canonical formula (e.g., "H2O")
    name?: string;           // Common name (optional, from PubChem)
    composition: Composition; // { "H": 2, "O": 1 }
    cid?: number;            // PubChem Compound ID (optional)
    synonyms?: string[];     // Alternative names (future)
    solubility?: string;     // Solubility info (future)
}

// Elemental Composition
type Composition = Record<string, number>;
// Example: { "H": 2, "O": 1 } for H2O

// Buffer Recipe
interface Recipe {
    id: string;                    // Unique ID
    name: string;                  // Recipe name (e.g., "10× PBS")
    description: string;           // Short description
    totalVolume: string;           // Total volume as string (e.g., "100")
    totalUnit: string;             // Volume unit (e.g., "mL")
    solutes: Solute[];             // Array of solutes
}

// Solute in Buffer
interface Solute {
    id: string;                    // Unique ID
    name: string;                  // Chemical name
    mw: string | number;           // Molecular weight
    conc: string;                  // Target concentration (number as string)
    unit: string;                  // Concentration unit
}

// App Navigation
type TabType =
    | "home"
    | "mw"
    | "dilution"
    | "buffer_calc"
    | "buffer_recipe"
    | "molarity";
```

### Periodic Table Structure

```typescript
// lib/constants.ts
const PTABLE: Record<string, number> = {
    "H": 1.008,
    "He": 4.003,
    "Li": 6.941,
    "C": 12.011,
    "N": 14.007,
    "O": 15.999,
    "Na": 22.990,
    "Cl": 35.453,
    // ... all 118 elements
};
```

---

## API Integration

### PubChem REST API

**Base URL:** `https://pubchem.ncbi.nlm.nih.gov/rest/pug`

**Endpoints Used:**

#### 1. Compound Lookup by Name
```http
GET /compound/name/{name}/property/MolecularFormula,MolecularWeight/JSON
```

**Example:**
```
GET /compound/name/aspirin/property/MolecularFormula,MolecularWeight/JSON
```

**Response:**
```json
{
  "PropertyTable": {
    "Properties": [
      {
        "CID": 2244,
        "MolecularFormula": "C9H8O4",
        "MolecularWeight": 180.16
      }
    ]
  }
}
```

#### 2. 2D Structure Image
```http
GET /compound/cid/{cid}/PNG
```

**Example:**
```
GET /compound/cid/2244/PNG
```
Returns PNG image (binary)

**Error Handling:**
- **404** → Chemical not found → Return `null`
- **Network Error** → Log error → Return `null`
- **Timeout** → Abort after 5s → Return `null`

**Rate Limiting:**
- No explicit limit documented
- Good practice: Cache results in session
- Future: Implement request debouncing

**Implementation:**
```typescript
// lib/api.ts
export async function lookupPubChem(query: string): Promise<ChemicalData | null> {
    try {
        const res = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/MolecularFormula,MolecularWeight/JSON`
        );

        if (!res.ok) return null;

        const data = await res.json();
        const props = data.PropertyTable.Properties[0];

        return {
            cid: props.CID,
            formula: props.MolecularFormula,
            mw: props.MolecularWeight,
            name: query,
            composition: parseFormula(props.MolecularFormula)
        };
    } catch (err) {
        console.error("PubChem error:", err);
        return null;
    }
}
```

---

## State Management

### Zustand Store Structure

**File:** `src/store/useStore.ts`

**Slices:**

```typescript
interface AppState {
    // ========== Navigation ==========
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;

    // ========== MW Calculator ==========
    mwInput: string;                           // Current input
    setMwInput: (val: string) => void;
    mwResult: ChemicalData | null;             // Current result
    setMwResult: (data: ChemicalData | null) => void;
    history: ChemicalData[];                   // Last 10 results
    addToHistory: (data: ChemicalData) => void;

    // ========== Dilution Calculator ==========
    dilution: {
        name: string;                          // Solute name
        mw: number;                            // Molecular weight
        c1: string;                            // Stock concentration
        u1: string;                            // Stock unit
        c2: string;                            // Target concentration
        u2: string;                            // Target unit
        v2: string;                            // Final volume
        vu2: string;                           // Volume unit
        linkedSoluteId: string | null;         // Link to buffer solute
    };
    setDilution: (data: Partial<AppState["dilution"]>) => void;

    // ========== Buffer Builder ==========
    bufferVolume: string;                      // Total volume
    bufferUnit: string;                        // Volume unit
    solutes: Solute[];                         // Array of solutes
    activeRecipeName: string | null;           // Current recipe name
    setBufferVolume: (val: string) => void;
    setBufferUnit: (unit: string) => void;
    addSolute: (data?: Partial<Solute>) => void;
    updateSolute: (id: string, data: Partial<Solute>) => void;
    removeSolute: (id: string) => void;
    clearSolutes: () => void;

    // ========== Recipe Library ==========
    savedRecipes: Recipe[];
    saveRecipe: (name: string, description: string) => void;
    loadRecipe: (recipe: Recipe) => void;
    deleteRecipe: (id: string) => void;

    // ========== Molarity Calculator ==========
    molarityState: {
        mw: number;
        mass: string;
        volume: string;
        concentration: string;
        massUnit: string;
        volUnit: string;
        concUnit: string;
        target: "mass" | "volume" | "concentration" | "mw";
    };
    setMolarityState: (data: Partial<AppState["molarityState"]>) => void;

    // ========== UI State ==========
    isHistoryOpen: boolean;
    setIsHistoryOpen: (val: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (val: boolean) => void;
    isRecipeLibraryOpen: boolean;
    setIsRecipeLibraryOpen: (val: boolean) => void;
    isSaveRecipeOpen: boolean;
    setIsSaveRecipeOpen: (val: boolean) => void;

    // ========== Actions ==========
    resetStore: () => void;                    // Clear all data
}
```

### Persistence Strategy

**Persisted Data:**
- ✅ History (last 10 MW calculations)
- ✅ Saved recipes
- ✅ Active tab
- ✅ Calculator inputs (for recovery)
- ✅ Molarity state

**NOT Persisted:**
- ❌ Modal open states (`isHistoryOpen`, etc.)
- ❌ Loading states
- ❌ Error messages

**Implementation:**
```typescript
persist(
    (set) => ({ /* state */ }),
    {
        name: "molweight-pro-storage",
        partialize: (state) => {
            const {
                isHistoryOpen, isSettingsOpen,
                isRecipeLibraryOpen, isSaveRecipeOpen,
                ...rest
            } = state;
            return rest;  // Don't persist UI state
        },
    }
)
```

---

## UI/UX Design System

### Color Palette

```css
/* Dark Background */
--bg-base: #18181b (zinc-900)
--bg-overlay: #27272a (zinc-800)

/* Glass Effect */
--glass-bg: rgba(255, 255, 255, 0.05)
--glass-border: rgba(255, 255, 255, 0.10)

/* Accent Colors */
--primary: #818cf8 (indigo-400)
--primary-hover: #6366f1 (indigo-500)
--success: #34d399 (emerald-400)
--error: #f87171 (red-400)
--warning: #fbbf24 (amber-400)

/* Text */
--text-primary: #ffffff
--text-secondary: #a1a1aa (zinc-400)
--text-tertiary: #71717a (zinc-500)
```

### Typography

```css
/* Font Family */
font-family: 'Geist Sans', 'Inter', system-ui, sans-serif;

/* Scale */
--text-xs: 0.75rem (12px)
--text-sm: 0.875rem (14px)
--text-base: 1rem (16px)
--text-lg: 1.125rem (18px)
--text-xl: 1.25rem (20px)
--text-2xl: 1.5rem (24px)
--text-3xl: 1.875rem (30px)
--text-4xl: 2.25rem (36px)

/* Weights */
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
--font-black: 900
```

### Component Styles

#### Glass Card
```tsx
<div className="
    bg-white/5
    backdrop-blur-md
    border border-white/10
    rounded-xl
    p-6
">
```

#### Primary Button
```tsx
<button className="
    px-4 py-2
    bg-indigo-500
    hover:bg-indigo-600
    text-white
    font-medium
    rounded-lg
    transition-all
    disabled:opacity-50
    disabled:cursor-not-allowed
">
```

#### Input Field
```tsx
<input className="
    w-full
    bg-white/5
    border border-white/10
    focus:border-indigo-500/50
    rounded-lg
    px-3 py-2
    text-white
    placeholder-zinc-500
    transition-all
    outline-none
" />
```

### Responsive Breakpoints

```css
/* Mobile First */
sm: 640px   /* Tablet */
md: 768px   /* Small laptop */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Animation Guidelines

**Framer Motion Variants:**

```typescript
// Slide-in from bottom
const slideUp = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
    transition: { duration: 0.3 }
};

// Fade in
const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
};
```

**Performance:**
- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Keep duration < 400ms for snappiness

---

## Development Environment

### Prerequisites

```bash
Node.js: >= 18.x
npm: >= 9.x
Git: Latest
```

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd molweight-pro

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev

# 4. Open browser
# Navigate to http://localhost:3000
```

### Project Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

### Environment Variables

**File:** `.env.local` (not in repo, create manually)

```bash
# Currently none required (PubChem is public API)
# Future additions might include:

# NEXT_PUBLIC_ANALYTICS_ID=xxx
# NEXT_PUBLIC_API_BASE_URL=https://api.molweight.pro
```

### File Watcher Limits (Linux)

```bash
# If you see "ENOSPC" errors:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Deployment

### Vercel (Current)

**Platform:** [Vercel](https://vercel.com)
**Auto-Deploy:** Enabled for `master` branch

**Build Settings:**
```bash
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
Node Version: 18.x
```

**Environment Variables:**
- None currently required
- Add via Vercel Dashboard → Project Settings → Environment Variables

**Custom Domain (Future):**
```
molweight.pro → Vercel deployment
```

### Manual Build

```bash
# 1. Build
npm run build

# 2. Test locally
npm run start

# 3. Deploy to Vercel
npx vercel --prod
```

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| First Contentful Paint | < 1.5s | TBD |
| Time to Interactive | < 3.0s | TBD |
| Lighthouse Score | > 90 | TBD |
| Bundle Size (JS) | < 200KB | ~150KB |

---

## Future Roadmap

### v1.1 - Enhanced Calculations
- [ ] **Stock Management:** Track chemical inventory
- [ ] **Molarity Calculator Expansion:** Add more unit types
- [ ] **Ionic Strength Calculator:** For buffer solutions
- [ ] **pH Calculator:** Buffer pH estimation

### v1.2 - Collaboration Features
- [ ] **Share Recipes:** Generate shareable links
- [ ] **Export to PDF:** Professional recipe printouts
- [ ] **Cloud Sync:** Save data across devices (auth required)

### v1.3 - Advanced Features
- [ ] **Batch Calculations:** Multiple MW lookups at once
- [ ] **Chemical Structure Editor:** Draw molecules (ChemDoodle?)
- [ ] **Safety Data Sheets:** Link to SDS for chemicals
- [ ] **Lab Notebook Integration:** Export to ELN formats

### v2.0 - Offline PWA
- [ ] **Progressive Web App:** Install on mobile/desktop
- [ ] **Offline Mode:** Full functionality without internet
- [ ] **Background Sync:** Queue API requests when offline
- [ ] **Push Notifications:** Calculation reminders (optional)

### Technical Debt
- [ ] Add unit tests (Jest + React Testing Library)
- [ ] Add E2E tests (Playwright)
- [ ] Implement error boundary components
- [ ] Add loading skeletons for better UX
- [ ] Optimize bundle size (lazy loading)

---

## Troubleshooting

### Common Issues

**Issue:** "Formula not recognized"
- **Cause:** Invalid syntax or unknown element
- **Fix:** Check formula matches standard notation (e.g., `H2O`, not `h2o`)

**Issue:** PubChem API fails
- **Cause:** Network error or rate limiting
- **Fix:** Retry after delay, or use formula input instead

**Issue:** LocalStorage quota exceeded
- **Cause:** Too many saved recipes/history
- **Fix:** Clear old data via Settings → Reset

**Issue:** Build fails with TypeScript errors
- **Cause:** Type mismatch or missing types
- **Fix:** Run `npm run build` to see detailed errors

---

## Contact & Support

**Repository:** [GitHub - molweight-pro](https://github.com/username/molweight-pro)
**Issues:** [GitHub Issues](https://github.com/username/molweight-pro/issues)
**Documentation:** See [DESIGN.md](./DESIGN.md) for detailed specs

---

**Last Updated:** 2025-12-31
**Maintained By:** Project Team
**License:** MIT (or appropriate license)
