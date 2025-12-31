/**
 * @file parser.ts
 * @description Chemical formula parsing engine with support for nested groups,
 * hydrates, and complex formulas. Implements recursive descent parsing with
 * stack-based group handling.
 * @module lib/parser
 * @version 1.0.0
 * @since 2025-01-01
 */

import { PTABLE, UNIT_LABELS } from "./constants";

/**
 * Map of element symbols to atom counts.
 *
 * @typedef {Record<string, number>} Composition
 * @example
 * const comp: Composition = { "H": 2, "O": 1 };  // H2O
 */
export type Composition = Record<string, number>;

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
 * @property {string} [solubility] - Solubility information (future feature)
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
    solubility?: string;
}

/**
 * Parses a chemical formula into its elemental composition.
 *
 * Supports standard notation including parentheses (), brackets [],
 * and hydrate notation using dots (·, *, .). Implements a stack-based
 * recursive descent parser to handle nested groups.
 *
 * @param {string} formula - Chemical formula (e.g., "H2O", "CuSO4·5H2O", "Ca(OH)2")
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
 * @example
 * parseFormula("CuSO4·5H2O")
 * // Returns: { "Cu": 1, "S": 1, "O": 9, "H": 10 }
 *
 * @see calculateMw for computing molecular weight from composition
 * @since 1.0.0
 */
export function parseFormula(formula: string): Composition {
    // Split by dot notation to handle hydrates (e.g., "CuSO4·5H2O")
    // Supports multiple separators: · (middot), * (asterisk), • (bullet), . (period)
    const parts = formula.replace(/[·*•]/g, ".").split(".");
    const totalComp: Composition = {};

    parts.forEach((part) => {
        // Check for leading multiplier (e.g., "5H2O" in hydrates like "CuSO4·5H2O")
        // Match pattern: digits followed by non-empty, non-digit string
        let multiplier = 1;
        const multMatch = part.match(/^(\d+)(.*)$/);
        let formulaPart = part;

        if (multMatch && multMatch[2].length > 0 && !/^\d+$/.test(multMatch[2])) {
            multiplier = parseInt(multMatch[1]);
            formulaPart = multMatch[2];
        }

        // Tokenize formula into elements, numbers, and grouping symbols
        // Regex: Capital letter + optional lowercase, OR digits, OR brackets/parentheses
        const tokens = formulaPart.match(/([A-Z][a-z]?|\d+|\(|\)|\[|\])/g);
        if (!tokens || tokens.join("") !== formulaPart) {
            throw new Error(`Invalid formula: ${formulaPart}`);
        }

        // Stack-based parsing for nested groups
        // Each stack level represents a group depth (parentheses or brackets)
        const stack: Composition[] = [{}];

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];

            if (t === "(" || t === "[") {
                // Open new group - push new composition level onto stack
                stack.push({});
            } else if (t === ")" || t === "]") {
                // Close group - pop stack and apply group multiplier
                const top = stack.pop();
                if (!top) throw new Error("Unbalanced parentheses/brackets");

                // Check for multiplier after closing bracket (e.g., "(OH)2")
                let next = tokens[i + 1];
                let groupMult = 1;
                if (next && /^\d+$/.test(next)) {
                    groupMult = parseInt(next);
                    i++;  // Skip the multiplier token
                }

                // Merge group composition back into parent level
                const current = stack[stack.length - 1];
                for (const atom in top) {
                    current[atom] = (current[atom] || 0) + top[atom] * groupMult;
                }
            } else if (/^[A-Z][a-z]?$/.test(t)) {
                // Element symbol - validate against periodic table
                if (!PTABLE[t]) {
                    throw new Error(`Unknown element: ${t}`);
                }

                // Check for element count (e.g., "H2" in "H2O")
                let next = tokens[i + 1];
                let count = 1;
                if (next && /^\d+$/.test(next)) {
                    count = parseInt(next);
                    i++;  // Skip the count token
                }

                // Add to current stack level
                const current = stack[stack.length - 1];
                current[t] = (current[t] || 0) + count;
            }
        }

        // Verify balanced brackets/parentheses
        if (stack.length !== 1) {
            throw new Error("Unbalanced parentheses/brackets");
        }

        // Merge this part into total composition (with hydrate multiplier if applicable)
        for (const atom in stack[0]) {
            totalComp[atom] = (totalComp[atom] || 0) + stack[0][atom] * multiplier;
        }
    });

    return totalComp;
}

/**
 * Calculates molecular weight from elemental composition.
 *
 * Sums the atomic weights of all elements multiplied by their counts.
 * Uses IUPAC standard atomic weights from the periodic table.
 *
 * @param {Composition} composition - Elemental composition (symbol->count map)
 * @returns {number} Molecular weight in g/mol
 *
 * @example
 * const comp = { "H": 2, "O": 1 };
 * calculateMw(comp);
 * // Returns: 18.015 (2 * 1.008 + 1 * 15.999)
 *
 * @see parseFormula for generating composition from formula strings
 * @since 1.0.0
 */
export function calculateMw(composition: Composition): number {
    return Object.entries(composition).reduce(
        (sum, [symbol, count]) => sum + PTABLE[symbol] * count,
        0
    );
}

/**
 * Formats a chemical formula for display (legacy function).
 *
 * Currently returns formula as-is. In React components, use FormulaBadge
 * component for proper subscript rendering.
 *
 * @param {string} formula - Chemical formula to format
 * @returns {string} Formatted formula string
 *
 * @deprecated Use FormulaBadge component for React rendering
 * @since 1.0.0
 */
export function formatFormula(formula: string): string {
    // Use regex to replace numbers with subscript-like spans for React
    // Note: For React we'll likely use a dedicated component, but for plain strings:
    return formula.replace(/([A-Za-z)\]])(\d+)/g, "$1$2");
}

/**
 * Trims trailing zeros from a fixed-precision number.
 *
 * Internal helper function for formatting display values.
 *
 * @param {number} val - Numeric value to trim
 * @param {number} precision - Number of decimal places for toFixed()
 * @returns {string} Trimmed numeric string without trailing zeros
 *
 * @example
 * trim(2.5000, 4)  // Returns: "2.5"
 * trim(2.0000, 4)  // Returns: "2"
 * trim(2.1230, 4)  // Returns: "2.123"
 */
const trim = (val: number, precision: number): string =>
    parseFloat(val.toFixed(precision)).toString();

/**
 * Gets the display label for a concentration/volume unit.
 *
 * @param {string} unit - Unit abbreviation (e.g., "M", "mL", "μM")
 * @returns {string} Display label (e.g., "M (Molar)", "mL (Milliliters)")
 *
 * @example
 * getUnitLabel("M")    // Returns: "M (Molar)"
 * getUnitLabel("mL")   // Returns: "mL (Milliliters)"
 * getUnitLabel("xyz")  // Returns: "xyz" (fallback to input)
 *
 * @since 1.0.0
 */
export function getUnitLabel(unit: string): string {
    return UNIT_LABELS[unit] || unit;
}

/**
 * Formats a volume value with appropriate units and precision.
 *
 * Automatically selects the most appropriate unit (nL, μL, mL, or L)
 * based on the magnitude of the input value in liters.
 *
 * @param {number} volL - Volume in liters
 * @returns {string} Formatted volume string with unit (e.g., "100 mL", "2.5 L")
 *
 * @example
 * formatVolume(0.1)        // Returns: "100 mL"
 * formatVolume(0.000001)   // Returns: "1 μL"
 * formatVolume(2.5)        // Returns: "2.5 L"
 * formatVolume(1e-9)       // Returns: "1 nL"
 *
 * @since 1.0.0
 */
export function formatVolume(volL: number): string {
    if (volL < 1e-6) return trim(volL * 1e9, 1) + " nL";   // Nanoliters
    if (volL < 1e-3) return trim(volL * 1e6, 1) + " μL";   // Microliters
    if (volL < 1) return trim(volL * 1e3, 3) + " mL";      // Milliliters
    return trim(volL, 3) + " L";                            // Liters
}

/**
 * Formats a mass value with appropriate units and precision.
 *
 * Automatically selects the most appropriate unit (ng, μg, mg, or g)
 * based on the magnitude of the input value in grams.
 *
 * @param {number} grams - Mass in grams
 * @returns {string} Formatted mass string with unit (e.g., "50 mg", "2.5 g")
 *
 * @example
 * formatMass(0.05)         // Returns: "50 mg"
 * formatMass(0.000001)     // Returns: "1 μg"
 * formatMass(2.5)          // Returns: "2.5 g"
 * formatMass(1e-9)         // Returns: "1 ng"
 *
 * @since 1.0.0
 */
export function formatMass(grams: number): string {
    if (grams < 1e-6) return trim(grams * 1e9, 1) + " ng";  // Nanograms
    if (grams < 1e-3) return trim(grams * 1e6, 1) + " μg";  // Micrograms
    if (grams < 1) return trim(grams * 1000, 1) + " mg";    // Milligrams
    return trim(grams, 3) + " g";                            // Grams
}

/**
 * Formats a concentration value with appropriate precision based on unit.
 *
 * Applies unit-specific precision rules following laboratory conventions:
 * - Molar (M): 3 decimal places
 * - Millimolar (mM), Micromolar (μM): 1 decimal place
 * - Mass-based (mg/mL, μg/mL, ng/μL): 1-2 decimal places
 * - Percentage: 2 decimal places
 *
 * @param {number | string} val - Concentration value (numeric or numeric string)
 * @param {string} unit - Concentration unit (e.g., "M", "mM", "mg/mL", "%")
 * @returns {string} Formatted concentration string (without unit)
 *
 * @example
 * formatConcentration(2.5, "M")      // Returns: "2.5"
 * formatConcentration(150.5, "mM")   // Returns: "150.5"
 * formatConcentration(5.123, "%")    // Returns: "5.12"
 * formatConcentration("invalid", "M") // Returns: "-"
 *
 * @since 1.0.0
 */
export function formatConcentration(val: number | string, unit: string): string {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n)) return "-";

    switch (unit) {
        case 'M':
            return trim(n, 3);
        case 'mM':
        case 'μM':
        case 'uM':
        case 'mg/mL':
        case 'dil':
            return trim(n, 1);
        case 'pct':
        case 'μg/mL':
        case 'ug/mL':
        case 'ng/μL':
        case 'ng/uL':
            return trim(n, 2);
        case 'g/L':
            return trim(n, 3);
        default:
            return n.toString();
    }
}
