/**
 * @file parser.ts
 * @description Chemical formula parsing engine with support for nested groups,
 * hydrates, decimal multipliers, and complex formulas. Implements recursive descent
 * parsing with stack-based group handling.
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
    smiles?: string;
    synonyms?: string[];
    solubility?: string;
}

/**
 * Compares two elemental compositions for equality.
 *
 * Compares element counts across both compositions to determine if they
 * represent the same chemical formula.
 *
 * @param {Composition} c1 - First composition
 * @param {Composition} c2 - Second composition
 * @returns {boolean} True if compositions match exactly
 *
 * @example
 * areCompositionsEqual({ H: 2, O: 1 }, { O: 1, H: 2 })  // true
 * areCompositionsEqual({ H: 2, O: 1 }, { H: 2, O: 2 })  // false
 */
export function areCompositionsEqual(c1: Composition, c2: Composition): boolean {
    const keys1 = Object.keys(c1);
    const keys2 = Object.keys(c2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every(key => c1[key] === c2[key]);
}

/**
 * Normalizes a chemical formula for parsing or display.
 *
 * Handles various formula formats and conventions:
 * - Strips phase indicators: (s), (l), (g), (aq)
 * - Strips charges: (2+), ++, +, etc.
 * - Maps unicode subscripts: ₀₁₂ to 012
 * - Standardizes hydrate separators to '.' for parsing or '·' for display
 * - Case-insensitive H2O normalization
 *
 * @param {string} formula - Chemical formula to normalize
 * @param {boolean} [forDisplay=true] - Use middot (·) for display, pipe (|) for parsing
 * @returns {string} Normalized formula string
 *
 * @example
 * normalizeFormula("CuSO4.5H2O", true)   // "CuSO4·5H2O"
 * normalizeFormula("CuSO4.5H2O", false)  // "CuSO4|5H2O"
 */
export function normalizeFormula(formula: string, forDisplay = true): string {
    const separator = forDisplay ? "·" : "|";
    return formula
        .replace(/\((s|l|g|aq|v)\)/gi, "") // Remove phase indicators
        .replace(/(\(\d*[+-]\)|\d*[+-]|[+-])/g, "") // Remove charges
        .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (m) => "0123456789"["₀₁₂₃₄₅₆₇₈₉".indexOf(m)]) // Map unicode subscripts
        // Normalize explicit hydration dots (·, *, •)
        .replace(/\s*[·*•]\s*/g, separator)
        // Heuristic for '.' as hydration dot: split by '.' ONLY if not a decimal point in a number
        // Decimals are \d\.\d. If we find . not surrounded by digits, or preceded by Alpha, it's a separator.
        .replace(/([A-Za-z)\]])\./g, `$1${separator}`)
        .replace(/\.(\d+H2O|\d+h2o)/gi, `${separator}$1`)
        // Space before H2O
        .replace(/\s+(?=\d*\.?\d*H2O|\d*\.?\d*h2o)/gi, separator)
        .replace(/\|/g, separator) // Handle internal vs display separator
        .replace(/h2o/gi, "H2O") // Case-insensitive H2O
        .trim();
}

/**
 * Parses a chemical formula into its elemental composition.
 *
 * Supports standard notation including parentheses (), brackets [],
 * hydrate notation using dots (·, *, .), and decimal multipliers (e.g., 0.5H2O).
 * Implements a stack-based recursive descent parser to handle nested groups.
 *
 * @param {string} formula - Chemical formula (e.g., "H2O", "CuSO4·5H2O", "Ca(OH)2", "Fe0.5O")
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
 * @example
 * parseFormula("Fe0.5O")
 * // Returns: { "Fe": 0.5, "O": 1 }
 *
 * @see calculateMw for computing molecular weight from composition
 * @since 1.0.0
 */
export function parseFormula(formula: string): Composition {
    const clean = normalizeFormula(formula, false);
    const parts = clean.split("|");
    const totalComp: Composition = {};

    parts.forEach((part) => {
        // Check for leading multiplier (e.g., "5H2O" in hydrates like "CuSO4·5H2O")
        // Match pattern: digits followed by non-empty, non-digit string
        let multiplier = 1;
        // Support decimal multipliers (e.g. 0.5H2O)
        const multMatch = part.match(/^(\d*\.?\d+)(.*)$/);
        let formulaPart = part;

        if (multMatch && multMatch[2].length > 0 && !/^\d*\.?\d+$/.test(multMatch[2])) {
            multiplier = parseFloat(multMatch[1]);
            formulaPart = multMatch[2];
        }

        // Support decimals in element counts (e.g. Fe0.5O)
        const tokens = formulaPart.match(/([A-Z][a-z]?|\d+\.\d+|\d+|\(|\)|\[|\])/g);
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

                const next = tokens[i + 1];
                let groupMult = 1;
                if (next && /^(\d+\.\d+|\d+)$/.test(next)) {
                    groupMult = parseFloat(next);
                    i++;
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

                const next = tokens[i + 1];
                let count = 1;
                if (next && /^(\d+\.\d+|\d+)$/.test(next)) {
                    count = parseFloat(next);
                    i++;
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
 * Generates a canonical Hill system formula from a composition.
 *
 * Hill system rules:
 * 1. If Carbon is present: C first, then H, then others alphabetical.
 * 2. If No Carbon: All elements alphabetical.
 *
 * @param {Composition} composition - Elemental composition
 * @returns {string} Hill system formula string
 *
 * @example
 * generateHillFormula({ C: 2, H: 6, O: 1 }) // "C2H6O"
 * generateHillFormula({ H: 2, O: 1 })       // "H2O"
 */
export function generateHillFormula(composition: Composition): string {
    const elements = Object.keys(composition).filter(el => composition[el] > 0);
    if (elements.length === 0) return "";

    let sortedElements: string[];
    if (composition["C"]) {
        const hasH = !!composition["H"];
        const others = elements.filter(el => el !== "C" && el !== "H").sort();
        sortedElements = hasH ? ["C", "H", ...others] : ["C", ...others];
    } else {
        sortedElements = elements.sort();
    }

    return sortedElements
        .map(el => {
            const count = composition[el];
            // CID search works best with rounded integer counts
            const roundedCount = Math.round(count);
            return roundedCount === 1 ? el : el + roundedCount;
        })
        .join("");
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

/**
 * Safely attempts to calculate MW from a string input.
 *
 * Validates input and attempts chemical formula parsing. Returns both the
 * molecular weight and normalized formula if successful.
 *
 * @param {string} input - Chemical formula string
 * @returns {{ mw: number; formula: string } | null} Result object or null if invalid
 *
 * @example
 * tryCalculateMw("H2O")  // { mw: 18.02, formula: "H2O" }
 * tryCalculateMw("xyz")  // null
 * tryCalculateMw("")     // null
 *
 * @since 1.0.0
 */
export function tryCalculateMw(input: string): { mw: number; formula: string } | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Must contain at least one capital letter (Element)
    if (!/[A-Z]/.test(trimmed)) return null;

    // Whitelist for local parsing
    if (!/^[A-Za-z0-9()\[\]·*•.\s₀₁₂₃₄₅₆₇₈₉+-]+$/.test(trimmed)) return null;

    try {
        const comp = parseFormula(trimmed);
        const mw = calculateMw(comp);
        if (mw > 0) {
            return {
                mw: parseFloat(mw.toFixed(2)),
                formula: normalizeFormula(trimmed, false) // un-normalized for internal storage
            };
        }
    } catch {
        // Silently fail if parsing error
    }
    return null;
}
