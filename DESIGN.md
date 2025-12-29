# MolWeight Pro - Design Document

**Version:** 1.0.0
**Date:** 2025-12-29
**Status:** In Development

## 1. Executive Summary

**MolWeight Pro** is a polished, high-performance web application designed for chemists, researchers, and students. Its primary function is to simplify daily laboratory calculations, specifically:
1.  **Molecular Weight Calculation**: Instantly find molecular weights from chemical names or formulas.
2.  **Dilutions**: Calculate volumes required to dilute stock solutions to target concentrations.
3.  **Buffer Construction**: Plan and "print" recipes for complex buffers with multiple solutes.

The application emphasizes a **modern, "glassmorphism" aesthetic**, responsiveness, and offline-first capabilities (where possible), distinguishing it from the utilitarian, dated interfaces common in scientific tools.

---

## 2. Technical Architecture

### 2.1 Technology Stack

*   **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) - Chosen for its component model, routing, and performance.
*   **Language**: [TypeScript](https://www.typescriptlang.org/) - Ensures type safety, critical for calculation accuracy.
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand) - Manages global app state (history, active recipes, user inputs) with local storage persistence.
*   **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first styling with a custom configuration for the "glass" theme.
*   **UI Components**: Custom React components + [Lucide React](https://lucide.dev/) icons.
*   **Animations**: [Framer Motion](https://www.framer.com/motion/) - For fluid transitions between calculators and interactions.
*   **Data Source**: 
    *   **Internal**: Custom recursive formula parser.
    *   **External**: [PubChem PUG REST API](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) for chemical name resolution and structure images.

### 2.2 Project Structure

```
molweight-pro/
├── src/
│   ├── app/                    # Next.js App Router root
│   │   ├── page.tsx            # Main SPA entry point
│   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   └── globals.css         # Global styles (Tailwind, variables)
│   ├── components/
│   │   ├── calculators/        # Feature-specific calculator components
│   │   │   ├── MWCalculator.tsx
│   │   │   ├── DilutionCalculator.tsx
│   │   │   └── BufferBuilder.tsx
│   │   └── ui/                 # Reusable UI atoms (FormulaBadge, etc.)
│   ├── lib/                    # Core logic and utilities
│   │   ├── parser.ts           # Chemical formula parsing engine
│   │   ├── api.ts              # PubChem API client
│   │   ├── recipes.ts          # Predefined buffer recipes
│   │   └── constants.ts        # Periodic table, unit definitions
│   └── store/
│       └── useStore.ts         # Global Zustand store
└── public/                     # Static assets
```

---

## 3. Core Features & Functional Requirements

### 3.1 Molecular Weight (MW) Calculator

*   **Input**: Smart input field accepting:
    *   **Chemical Formulas**: e.g., "H2O", "CuSO4·5H2O", "C6H12O6".
    *   **Common Names**: e.g., "Aspirin", "Ethanol" (via PubChem).
*   **Parsing Logic**:
    *   Must support standard elemental symbols (case-sensitive).
    *   Must support parentheses `()` and brackets `[]` for grouping.
    *   Must support dot notation `.` or `·` or `*` for hydrates/adducts.
    *   Fallback: If local parsing fails, query PubChem API.
*   **Output**: 
    *   Molecular Weight (g/mol).
    *   Canonical Formula (prettified with subscripts).
    *   Chemical Name (if available).
    *   2D Structure Image (fetched via CID).
*   **History**: Automatically save valid calculations to a "Recent History" list for quick recall.

### 3.2 Dilution Calculator

*   **Formula**: Implements $C_1V_1 = C_2V_2$.
*   **Inputs**:
    *   **Stock (Source)**: Concentration ($C_1$).
    *   **Target (Destination)**: Concentration ($C_2$), Final Volume ($V_2$).
    *   **Solute Info**: Chemical Name/MW (optional, allows mass-based conversion).
*   **Units**:
    *   Concentration: M, mM, μM, g/L, mg/mL, %, etc.
    *   Volume: L, mL, μL.
*   **Logic**:
    *   Real-time validation (ensure consistent units or auto-convert).
    *   Calculation of required Stock Volume ($V_1$).

### 3.3 Buffer Builder

*   **Goal**: Create recipes for complex solutions containing multiple solutes (e.g., PBS, Tris-EDTA).
*   **Functionality**:
    *   Define Total Volume.
    *   Add/Remove Solutes (Name, MW, Target Concentration).
    *   Calculate required mass for each solute.
*   **Recipe Management**:
    *   Save custom recipes.
    *   Load predefined common lab recipes (e.g., 10x PBS).
*   **Print Mode**:
    *   Dedicated "Checklist View" for lab use.
    *   Hides UI clutter, emphasizes masses and chemical names.
    *   Interactive checkboxes (even in print view) to track progress.

---

## 4. Data Flow & State Management

### 4.1 Global Store (`useStore.ts`)

The application uses a centralized store to ensure fluidity between tools. For example, a user finding the MW of "NaCl" in the MW Calculator can easily "carry over" that MW to the Dilution Calculator.

**Key Slices:**
*   **Navigation**: `activeTab` ("mw" | "dilution" | "buffer").
*   **MW State**: `mwInput`, `mwResult`, `history`.
*   **Dilution State**: `c1`, `v1`, `c2`, `v2`, plus unit selections.
*   **Buffer State**: `solutes` array, `bufferVolume`, `savedRecipes`.
*   **Persistence**: Uses `localStorage` to retain history and saved recipes between sessions.

### 4.2 Chemical Parsing Flow

1.  **User Input**: String (e.g., "EtOH").
2.  **Local Check**: Regex check for pure formula (e.g., "C2H6O").
    *   *If Formula*: Parse using `parser.ts` (recursive descent). Calculate MW from periodic table constants.
3.  **Remote Check** (if local fails): Call `api.ts` -> `lookupPubChem`.
    *   *Response*: Returns JSON with CID, Canonical Formula, MW, Name.
    *   *Action*: Parse the returned canonical formula locally to get elemental composition.
4.  **Result**: Update Store -> Update UI.

---

## 5. UI/UX Design System

### 5.1 Aesthetic: "Scientific Glass"
*   **Background**: Deep, dark gradients (Zinc/Slate/Indigo mix) representing a modern "dark mode" lab environment.
*   **Cards**: Translucent "glass" panels (`bg-white/5`, `backdrop-blur-md`, `border-white/10`).
*   **Typography**: Clean sans-serif (Inter/Geist) for readability. Monospace for formulas and numbers.
*   **Accent Color**: Indigo/Violet (`text-indigo-400`) for primary actions and active states.

### 5.2 Interactions
*   **Feedback**: Loading spinners during API calls.
*   **Error Handling**: Inline red alerts for invalid formulas or network errors.
*   **Accessibility**: Keyboard navigation support for inputs.

---

## 6. Implementation Guidelines

### 6.1 Formula Parser (`src/lib/parser.ts`)
Must implement handle a simplified grammar:
```ebnf
formula = part+
part = (element | group) [multiplier]
group = "(" formula ")" | "[" formula "]"
element = "H" | "He" | ... (Standard PT symbols)
multiplier = integer
```
*Note: Special handling for dot-notation hydrates (e.g., `.5H2O`).*

### 6.2 PubChem API Integration (`src/lib/api.ts`)
*   Endpoint: `https://pubchem.ncbi.nlm.nih.gov/rest/pug`
*   Method: `GET`
*   Caching: Responses should be cached in the session (via React Query or simple Store history) to avoid rate limits.

### 6.3 Future Roadmap (Post-v1)
*   **Molarity Calculator**: Dedicated tool for Mass <-> Moles <-> Vol conversions.
*   **Stock Management**: expanded inventory features.
*   **Export**: PDF export for recipes (beyond browser print).
