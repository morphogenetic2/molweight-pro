/**
 * @file api.ts
 * @description PubChem PUG REST API client for chemical compound lookups.
 * Fetches molecular data, structures, and synonyms from the PubChem database.
 * @module lib/api
 * @version 1.0.0
 * @since 2025-01-01
 */

import { ChemicalData } from "./parser";

/**
 * Queries PubChem database for a compound ID (CID) by molecular formula.
 *
 * Searches PubChem for compounds matching the given molecular formula and returns
 * the first matching CID. This enables 2D structure visualization for manually
 * entered chemical formulas.
 *
 * @async
 * @param {string} formula - Molecular formula (e.g., "H2O", "C6H12O6", "NaCl")
 * @returns {Promise<number | null>} PubChem Compound ID or null if not found
 *
 * @example
 * // Successful lookup
 * const cid = await lookupPubChemByFormula("H2O");
 * // Returns: 962 (CID for water)
 *
 * @example
 * // Failed lookup (invalid formula)
 * const cid = await lookupPubChemByFormula("XYZ123");
 * // Returns: null
 *
 * @throws Never throws - returns null on all errors
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * @since 1.0.0
 */
export async function lookupPubChemByFormula(formula: string): Promise<number | null> {
    try {
        // Search for CID by molecular formula
        const searchRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/${encodeURIComponent(formula)}/cids/JSON`
        );

        // 404 = formula not found, not an error condition
        if (!searchRes.ok) {
            console.warn(`PubChem: Formula "${formula}" not found (HTTP ${searchRes.status})`);
            return null;
        }

        const searchData = await searchRes.json();

        // Validate response structure and return first CID
        if (!searchData?.IdentifierList?.CID || searchData.IdentifierList.CID.length === 0) {
            console.warn(`PubChem: No CID found for formula "${formula}"`);
            return null;
        }

        // Return the first CID (most common compound with this formula)
        const cid = searchData.IdentifierList.CID[0];
        return cid || null;
    } catch (error) {
        // Log error for debugging but return null for graceful degradation
        console.error("PubChem formula lookup error:", error);
        return null;
    }
}

/**
 * Queries PubChem database for chemical information by name or identifier.
 *
 * Performs a three-step API call sequence:
 * 1. Search for Compound ID (CID) by chemical name
 * 2. Fetch molecular properties (formula, weight, IUPAC name)
 * 3. Fetch synonyms (common names, trade names)
 *
 * Returns null on any failure (network error, compound not found, API error)
 * rather than throwing, allowing graceful degradation to local formula parsing.
 *
 * @async
 * @param {string} query - Chemical name or identifier (e.g., "aspirin", "ethanol", "glucose")
 * @returns {Promise<Partial<ChemicalData> | null>} Chemical data object or null if lookup fails
 *
 * @example
 * // Successful lookup
 * const aspirin = await lookupPubChem("aspirin");
 * // Returns: {
 * //   cid: 2244,
 * //   mw: 180.16,
 * //   formula: "C9H8O4",
 * //   name: "2-acetyloxybenzoic acid",
 * //   synonyms: ["aspirin", "acetylsalicylic acid", ...]
 * // }
 *
 * @example
 * // Failed lookup (compound not found)
 * const unknown = await lookupPubChem("xyzInvalidName");
 * // Returns: null
 *
 * @example
 * // Lookup with special characters
 * const glucose = await lookupPubChem("α-D-glucose");
 * // Automatically encodes special characters in URL
 *
 * @throws Never throws - returns null on all errors
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * @since 1.0.0
 */
export async function lookupPubChem(query: string): Promise<Partial<ChemicalData> | null> {
    try {
        // Step 1: Search for Compound ID (CID) by name
        // Encode query to handle special characters (e.g., "α-glucose", "2,4-D")
        const searchRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`
        );

        // 404 = compound not found, not an error condition
        if (!searchRes.ok) {
            console.warn(`PubChem: Compound "${query}" not found (HTTP ${searchRes.status})`);
            return null;
        }

        const searchData = await searchRes.json();
        const cid = searchData.IdentifierList.CID[0];

        // Step 2: Fetch molecular properties
        // Request molecular formula, weight, and IUPAC name
        const propRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`
        );

        if (!propRes.ok) {
            console.warn(`PubChem: Failed to fetch properties for CID ${cid} (HTTP ${propRes.status})`);
            return null;
        }

        const propData = await propRes.json();
        const prop = propData.PropertyTable.Properties[0];

        // Step 3: Fetch synonyms (common names, trade names, etc.)
        // This call is optional - don't fail if synonyms are unavailable
        const synRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`
        );

        const synonyms = synRes.ok
            ? (await synRes.json()).InformationList.Information[0].Synonym
            : [];

        // Return structured data (composition will be calculated from formula)
        return {
            cid,
            mw: parseFloat(prop.MolecularWeight),
            formula: prop.MolecularFormula,
            name: prop.IUPACName,
            synonyms,
        };
    } catch (error) {
        // Log error for debugging but return null for graceful degradation
        // This allows the app to fall back to local formula parsing
        console.error("PubChem API error:", error);
        return null;
    }
}
