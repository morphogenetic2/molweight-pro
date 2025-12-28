import { PTABLE } from "./constants";

export type Composition = Record<string, number>;

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
 * Supports hydrates (.), parentheses (), and brackets [].
 */
export function parseFormula(formula: string): Composition {
    const parts = formula.replace(/[·*•]/g, ".").split(".");
    const totalComp: Composition = {};

    parts.forEach((part) => {
        let multiplier = 1;
        const multMatch = part.match(/^(\d+)(.*)$/);
        let formulaPart = part;

        if (multMatch && multMatch[2].length > 0 && !/^\d+$/.test(multMatch[2])) {
            multiplier = parseInt(multMatch[1]);
            formulaPart = multMatch[2];
        }

        const tokens = formulaPart.match(/([A-Z][a-z]?|\d+|\(|\)|\[|\])/g);
        if (!tokens || tokens.join("") !== formulaPart) {
            throw new Error(`Invalid formula: ${formulaPart}`);
        }

        const stack: Composition[] = [{}];

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t === "(" || t === "[") {
                stack.push({});
            } else if (t === ")" || t === "]") {
                const top = stack.pop();
                if (!top) throw new Error("Unbalanced parentheses/brackets");

                let next = tokens[i + 1];
                let groupMult = 1;
                if (next && /^\d+$/.test(next)) {
                    groupMult = parseInt(next);
                    i++;
                }

                const current = stack[stack.length - 1];
                for (const atom in top) {
                    current[atom] = (current[atom] || 0) + top[atom] * groupMult;
                }
            } else if (/^[A-Z][a-z]?$/.test(t)) {
                if (!PTABLE[t]) {
                    throw new Error(`Unknown element: ${t}`);
                }

                let next = tokens[i + 1];
                let count = 1;
                if (next && /^\d+$/.test(next)) {
                    count = parseInt(next);
                    i++;
                }

                const current = stack[stack.length - 1];
                current[t] = (current[t] || 0) + count;
            }
        }

        if (stack.length !== 1) {
            throw new Error("Unbalanced parentheses/brackets");
        }

        for (const atom in stack[0]) {
            totalComp[atom] = (totalComp[atom] || 0) + stack[0][atom] * multiplier;
        }
    });

    return totalComp;
}

export function calculateMw(composition: Composition): number {
    return Object.entries(composition).reduce(
        (sum, [symbol, count]) => sum + PTABLE[symbol] * count,
        0
    );
}

export function formatFormula(formula: string): string {
    // Use regex to replace numbers with subscript-like spans for React
    // Note: For React we'll likely use a dedicated component, but for plain strings:
    return formula.replace(/([A-Za-z)\]])(\d+)/g, "$1$2");
}

export function formatVolume(volL: number): string {
    if (volL < 1e-6) return (volL * 1e9).toFixed(1) + " nL";
    if (volL < 1e-3) return (volL * 1e6).toFixed(1) + " μL";
    if (volL < 1) return (volL * 1e3).toFixed(1) + " mL";
    return volL.toFixed(3) + " L";
}

export function formatMass(grams: number): string {
    if (grams < 1e-6) return (grams * 1e9).toFixed(1) + " ng";
    if (grams < 1e-3) return (grams * 1e6).toFixed(1) + " μg";
    if (grams < 1) return (grams * 1000).toFixed(1) + " mg";
    return grams.toFixed(3) + " g";
}
