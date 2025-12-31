# MolWeight Pro

A comprehensive suite of digital tools designed for molecular biologists and chemists. MolWeight Pro streamlines common laboratory calculations into a single, modern, and offline-capable interface.

**Live Demo:** [molweightpro.vercel.app](https://molweightpro.vercel.app)

---

## Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Development](#development)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Molecular Weight Calculator
- **Smart Parsing**: Calculate molecular weights from chemical formulas (e.g., `C6H12O6`) or common names (e.g., `Aspirin`)
- **PubChem Integration**: Automatically fetches molecular data and 2D structure images
- **History Tracking**: Persistent history of recent calculations for quick reference
- **Offline-Capable**: Local formula parsing works without internet connection

### Dilution Calculator
- **C₁V₁ = C₂V₂ Implementation**: Accurate dilution calculations with full unit conversion
- **Multi-Unit Support**: Seamless conversion between M, mM, μM, g/L, mg/mL, and percentage concentrations
- **Volume Units**: Automatic formatting for L, mL, and μL
- **Integrated Workflow**: Import molecular weights directly from MW Calculator

### Molarity Calculator
- **Flexible Solving**: Calculate mass, concentration, or volume by selecting target variable
- **Dynamic Units**: Real-time conversion between molarity and mass-based concentrations
- **Scientific Accuracy**: Precise calculations following laboratory standards

### Buffer Calculator & Recipe Builder
- **Reference Library**: Pre-configured recipes for common buffers (PBS, Tris-EDTA, TAE, RIPA)
- **Custom Recipes**: Build complex multi-component solutions with automatic mass calculations
- **Stock Solutions**: Support for diluting from concentrated stocks
- **Save & Load**: Persistent storage of custom recipes via localStorage
- **Print-Friendly**: Clean checklist view optimized for lab use

---

## Getting Started

### Prerequisites
- **Node.js** 18.x or higher
- **npm** 9.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/morphogenetic2/molweight-pro.git
cd molweight-pro

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Building for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run start
```

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.x | React framework with App Router |
| **React** | 19.x | UI component library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **Zustand** | 5.x | Lightweight state management |
| **Framer Motion** | 12.x | Animation library |
| **Lucide React** | Latest | Icon library |

**External APIs:**
- **PubChem PUG REST API**: Chemical compound data and structure images

---

## Project Structure

```
molweight-pro/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Main application entry point
│   │   ├── layout.tsx         # Root layout with fonts and metadata
│   │   └── globals.css        # Global styles and Tailwind directives
│   ├── components/
│   │   ├── calculators/       # Feature-specific calculator components
│   │   │   ├── MWCalculator.tsx
│   │   │   ├── DilutionCalculator.tsx
│   │   │   ├── BufferBuilder.tsx
│   │   │   ├── BufferCalculator.tsx
│   │   │   └── MolarityCalculator.tsx
│   │   └── ui/                # Reusable UI components
│   │       ├── FormulaBadge.tsx
│   │       ├── HistoryPanel.tsx
│   │       ├── RecipeLibrary.tsx
│   │       ├── SaveRecipeModal.tsx
│   │       └── SettingsModal.tsx
│   ├── lib/                   # Core business logic
│   │   ├── parser.ts         # Chemical formula parser
│   │   ├── api.ts            # PubChem API client
│   │   ├── recipes.ts        # Buffer recipe definitions
│   │   ├── constants.ts      # Periodic table and unit constants
│   │   └── utils.ts          # Utility functions
│   └── store/
│       └── useStore.ts       # Zustand global state management
├── public/                    # Static assets
├── AGENT.md                   # Technical specification and architecture
├── CLAUDE.md                  # Coding standards and style guide
├── CHANGELOG.md               # Version history and updates
└── README.md                  # This file
```

---

## Development

### Coding Standards

This project follows strict coding standards documented in [CLAUDE.md](CLAUDE.md). Key principles:

- **Type Safety**: TypeScript strict mode with explicit types (no `any`)
- **JSDoc Documentation**: All exported functions must have comprehensive JSDoc comments
- **No Emojis**: Professional tone maintained throughout codebase
- **Mobile-First**: Responsive design using Tailwind's mobile-first breakpoints
- **Scientific Accuracy**: Precise calculations using standard atomic weights

### Running Linter

```bash
npm run lint
```

### Key Commands

```bash
npm run dev       # Start development server with hot reload
npm run build     # Create production build
npm run start     # Serve production build
npm run lint      # Run ESLint on codebase
```

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)**: Comprehensive coding standards, naming conventions, TypeScript patterns, and documentation requirements
- **[AGENT.md](AGENT.md)**: Technical specification including architecture, data models, API integration, and deployment guide
- **[CHANGELOG.md](CHANGELOG.md)**: Detailed version history and release notes

---

## Contributing

Contributions are welcome! Please ensure your code:

1. Follows all standards in [CLAUDE.md](CLAUDE.md)
2. Includes JSDoc comments for all exported functions
3. Passes TypeScript compilation without errors (`npm run build`)
4. Uses mobile-first responsive design patterns
5. Contains no emojis in code or documentation

### Contribution Workflow

```bash
# Create a feature branch
git checkout -b feat/your-feature-name

# Make changes and commit following the format:
# <type>(<scope>): <description>
git commit -m "feat(buffer): Add PDF export functionality"

# Push and create pull request
git push origin feat/your-feature-name
```

---

## License

This project is open source and available for personal and educational use.

---

## Acknowledgments

- **PubChem** for providing free access to chemical compound data
- **IUPAC** for standard atomic weight values
- **Vercel** for hosting and deployment platform

---

**Version:** 1.1.0
**Last Updated:** 2025-12-31
**Maintained By:** [morphogenetic2](https://github.com/morphogenetic2)
