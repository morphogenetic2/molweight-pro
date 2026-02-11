/**
 * @file recipes.ts
 * @description Predefined buffer recipes and recipe data structures.
 * Contains common laboratory buffer formulations (PBS, TAE, TBE, RIPA, etc.)
 * @module lib/recipes
 * @version 1.0.0
 * @since 2025-01-01
 */

/**
 * Represents a solute component in a buffer recipe.
 *
 * @interface RecipeSolute
 * @property {string} name - Chemical name of the solute
 * @property {string} mw - Molecular weight in g/mol (as string for form compatibility)
 * @property {string} conc - Target concentration (as string for form compatibility)
 * @property {string} unit - Concentration unit (e.g., "M", "mM", "pct")
 * @property {boolean} [isStock] - Whether this solute is from a stock solution
 * @property {string} [stockConc] - Stock solution concentration (if isStock is true)
 * @property {string} [stockUnit] - Stock solution unit (if isStock is true)
 */
export interface RecipeSolute {
    name: string;
    mw: string;
    conc: string;
    unit: string;
    isStock?: boolean;
    stockConc?: string;
    stockUnit?: string;
}

/**
 * Represents a complete buffer recipe with metadata and solute list.
 *
 * @interface Recipe
 * @property {string} id - Unique identifier for the recipe
 * @property {string} name - Display name of the buffer (e.g., "PBS (10X)")
 * @property {string} description - Brief description of buffer purpose and use case
 * @property {string} totalVolume - Total volume to prepare (as string for form compatibility)
 * @property {string} totalUnit - Volume unit (e.g., "mL", "L")
 * @property {RecipeSolute[]} solutes - Array of solute components in the recipe
 */
export interface Recipe {
    id: string;
    name: string;
    description: string;
    totalVolume: string;
    totalUnit: string;
    solutes: RecipeSolute[];
}

/**
 * Predefined Laboratory Buffer Recipes
 *
 * Collection of commonly used buffer formulations in molecular biology and biochemistry.
 * Includes standard buffers like PBS, TAE, TBE, RIPA, and others with accurate concentrations.
 *
 * Each recipe contains:
 * - Buffer name and description
 * - Total volume and unit
 * - Complete solute list with molecular weights and concentrations
 * - Stock solution information where applicable
 *
 * @constant
 * @type {Recipe[]}
 * @since 1.0.0
 */
export const DEFAULT_RECIPES: Recipe[] = [
    {
        id: "pbs-10x",
        name: "PBS (10X)",
        description: "Phosphate Buffered Saline, 10X concentrate. Common biological buffer.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "NaCl", mw: "58.44", conc: "1.37", unit: "M" },
            { name: "KCl", mw: "74.55", conc: "27", unit: "mM" },
            { name: "Na2HPO4", mw: "141.96", conc: "100", unit: "mM" },
            { name: "KH2PO4", mw: "136.09", conc: "18", unit: "mM" }
        ]
    },
    {
        id: "tae-50x",
        name: "TAE (50X)",
        description: "Tris-Acetate-EDTA, 50X concentrate. Used for electrophoresis.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "Tris Base", mw: "121.14", conc: "2", unit: "M" },
            { name: "Glacial Acetic Acid", mw: "60.05", conc: "1", unit: "M" },
            { name: "EDTA (0.5M, pH 8.0)", mw: "292.24", conc: "50", unit: "mM", isStock: true, stockConc: "0.5", stockUnit: "M" }
        ]
    },
    {
        id: "tbe-10x",
        name: "TBE (10X)",
        description: "Tris-Borate-EDTA, 10X concentrate. Used for DNA/RNA electrophoresis.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "Tris Base", mw: "121.14", conc: "0.89", unit: "M" },
            { name: "Boric Acid", mw: "61.83", conc: "0.89", unit: "M" },
            { name: "EDTA", mw: "292.24", conc: "20", unit: "mM" }
        ]
    },
    {
        id: "tris-hcl-1m",
        name: "Tris-HCl (1M)",
        description: "Standard 1M Tris-HCl buffer (pH adjustable).",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "Tris Base", mw: "121.14", conc: "1", unit: "M" }
        ]
    },
    {
        id: "hbss",
        name: "HBSS",
        description: "Hank's Balanced Salt Solution. Used for cell washing and transport.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "NaCl", mw: "58.44", conc: "137.93", unit: "mM" },
            { name: "KCl", mw: "74.55", conc: "5.33", unit: "mM" },
            { name: "CaCl2", mw: "110.98", conc: "1.26", unit: "mM" },
            { name: "MgCl2·6H2O", mw: "203.31", conc: "0.49", unit: "mM" },
            { name: "MgSO4·7H2O", mw: "246.47", conc: "0.41", unit: "mM" },
            { name: "Na2HPO4", mw: "141.96", conc: "0.34", unit: "mM" },
            { name: "KH2PO4", mw: "136.09", conc: "0.44", unit: "mM" },
            { name: "Glucose", mw: "180.16", conc: "5.56", unit: "mM" },
            { name: "NaHCO3", mw: "84.01", conc: "4.17", unit: "mM" }
        ]
    },
    {
        id: "te-10x",
        name: "TE Buffer (10X)",
        description: "Tris-EDTA 10X concentrate. Standard DNA/RNA storage buffer.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "Tris Base", mw: "121.14", conc: "100", unit: "mM" },
            { name: "EDTA (0.5M, pH 8.0)", mw: "292.24", conc: "10", unit: "mM", isStock: true, stockConc: "0.5", stockUnit: "M" }
        ]
    },
    {
        id: "tbst-10x",
        name: "TBS-T (10X)",
        description: "Tris-Buffered Saline with Tween-20, 10X concentrate. Western Blot wash buffer.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "Tris Base", mw: "121.14", conc: "200", unit: "mM" },
            { name: "NaCl", mw: "58.44", conc: "1.5", unit: "M" },
            { name: "Tween-20", mw: "1227.5", conc: "1", unit: "pct" }
        ]
    },
    {
        id: "ssc-20x",
        name: "SSC Buffer (20X)",
        description: "Saline-Sodium Citrate 20X concentrate. Used for hybridization.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "NaCl", mw: "58.44", conc: "3", unit: "M" },
            { name: "Trisodium Citrate·2H2O", mw: "294.1", conc: "300", unit: "mM" }
        ]
    },
    {
        id: "ripa",
        name: "RIPA Lysis Buffer",
        description: "Radioimmunoprecipitation Assay buffer. For efficient cell lysis and protein solubilization.",
        totalVolume: "1000",
        totalUnit: "mL",
        solutes: [
            { name: "Tris Base", mw: "121.14", conc: "50", unit: "mM" },
            { name: "NaCl", mw: "58.44", conc: "150", unit: "mM" },
            { name: "NP-40 / IGEPAL CA-630", mw: "602.8", conc: "1", unit: "pct" },
            { name: "Sodium Deoxycholate", mw: "414.55", conc: "0.5", unit: "pct" },
            { name: "SDS", mw: "288.38", conc: "0.1", unit: "pct" }
        ]
    }
];
