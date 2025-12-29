# MolWeight Pro

**MolWeight Pro** is a comprehensive suite of digital tools designed for molecular biologists and chemists. It streamlines common laboratory calculations into a single, beautiful, and offline-capable interface.

[MolWeight Pro public instance](https://molweightpro.vercel.app)

## Features

### 🧪 Molecular Weight Calculator
*   **Smart Parsing**: Instantly calculate molecular weight from chemical formulas (e.g., `C6H12O6`) or common names (e.g., `Acetone`).
*   **PubChem Integration**: Automatically fetches structure images and data from PubChem.
*   **History**: Keeps track of your recent calculations for quick access.

### 💧 Dilution Calculator
*   **$C_1V_1 = C_2V_2$**: Effortlessly calculate required volumes for dilutions.
*   **Unit Conversion**: Auto-converts between various units (mM, µM, mL, L) so you don't have to doing mental math.
*   **MW Input**: Easily import molecular weights from the MW Calculator.
*   **Linked Solute**: Automatically updates the solute when you change the dilution.

### 📐 Molarity Triangle
*   **Solve for Any Variable**: Calculate Mass, Concentration, or Volume by locking the target field.
*   **Dynamic Units**: Switch seamlessly between molarity ($M$) and mass concentration ($g/L$).

### ⚗️ Buffer Calculator & Recipe Builder
*   **Reference Library**: Built-in presets for common buffers (PBS, Tris-EDTA, TAE).
*   **Recipe Builder**: Create complex, multi-ingredient recipes with automatic mass calculations.
*   **pH Adjusters**: Calculate the exact amount of acid/base needed for titration.
*   **Save & Load**: Persist your custom recipes locally.

## Getting Started

### Prerequisites
*   Node.js 18+
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/morphogenetic2/molweight-pro.git
    cd molweight-pro
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Technology Stack

*   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Icons**: [Lucide React](https://lucide.dev/)

## License

This project is open source and available for personal and educational use.
