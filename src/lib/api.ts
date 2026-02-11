/**
 * @file api.ts
 * @description PubChem PUG REST API client for chemical compound lookups.
 * Fetches molecular data, structures, and synonyms from the PubChem database.
 * @module lib/api
 * @version 1.0.0
 * @since 2025-01-01
 */

import { ChemicalData, parseFormula, areCompositionsEqual, normalizeFormula, generateHillFormula } from "./parser";

interface PubChemProperty {
    MolecularFormula: string;
    MolecularWeight: string;
    IUPACName?: string;
    CanonicalSMILES?: string;
    IsomericSMILES?: string;
    SMILES?: string;
}

interface PubChemPropertyResult extends PubChemProperty {
    smiles: string | null;
}

type CidSearchResponse = {
    IdentifierList?: {
        CID?: number[];
    };
};

type SynonymsResponse = {
    InformationList?: {
        Information?: Array<{
            Synonym?: string[];
        }>;
    };
};

function buildFormulaLookupCandidates(formula: string): string[] {
    const candidates = new Set<string>();
    const trimmed = formula.trim();
    if (!trimmed) return [];

    const addCandidate = (value: string) => {
        const normalized = value.trim();
        if (normalized) {
            candidates.add(normalized);
        }
    };

    // PubChem name endpoint is hydrate-friendly with dots.
    const parserNormalized = normalizeFormula(trimmed, false); // uses "|" as internal separator
    addCandidate(parserNormalized.replace(/\|/g, ".")); // e.g., CuSO4.5H2O
    addCandidate(trimmed);

    // Common hydrate separators in user input
    addCandidate(trimmed.replace(/\s*[·*•]\s*/g, "."));

    try {
        const comp = parseFormula(trimmed);
        addCandidate(generateHillFormula(comp));
    } catch {
        // ignore parse errors and keep best-effort candidate set
    }

    return Array.from(candidates);
}

async function fetchFirstCidByFormulaQuery(searchFormula: string): Promise<number | null> {
    const searchRes = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/${encodeURIComponent(searchFormula)}/cids/JSON`
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json()) as CidSearchResponse;
    return searchData.IdentifierList?.CID?.[0] ?? null;
}

async function fetchFirstCidByNameQuery(query: string): Promise<number | null> {
    const searchRes = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json()) as CidSearchResponse;
    return searchData.IdentifierList?.CID?.[0] ?? null;
}

/**
 * Fetches molecular properties for a given CID.
 * 
 * @async
 * @param {number} cid - PubChem Compound ID
 * @returns {Promise<PubChemPropertyResult | null>} Properties object or null
 */
async function fetchProperties(cid: number): Promise<PubChemPropertyResult | null> {
    const propRes = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES/JSON`
    );
    if (!propRes.ok) return null;
    const data = (await propRes.json()) as {
        PropertyTable?: {
            Properties?: PubChemProperty[];
        };
    };
    const prop = data.PropertyTable?.Properties?.[0];
    if (!prop) return null;
    
    // PubChem usually provides both, but fallback just in case
    const smiles = prop.IsomericSMILES || prop.CanonicalSMILES || prop.SMILES;
    
    return {
        ...prop,
        smiles: smiles || null
    };
}

/**
 * Queries PubChem database for a compound ID (CID) and SMILES by molecular formula.
 *
 * This function first canonicalizes the formula into the Hill System (C first,
 * then H, then alphabetical) to ensure compatibility with PubChem search rules.
 *
 * @async
 * @param {string} formula - Molecular formula (e.g., "H2O", "C6H12O6", "NaCl")
 * @returns {Promise<{cid: number, smiles: string} | null>} CID and SMILES or null
 */
export async function lookupPubChemByFormula(formula: string): Promise<{cid: number, smiles?: string} | null> {
    try {
        const candidates = buildFormulaLookupCandidates(formula);
        if (candidates.length === 0) return null;

        // 1) Try formula endpoint for all normalized candidates.
        for (const candidate of candidates) {
            const cid = await fetchFirstCidByFormulaQuery(candidate);
            if (!cid) continue;

            const prop = await fetchProperties(cid);
            return {
                cid,
                smiles: prop?.smiles || undefined
            };
        }

        // 2) Fallback to name endpoint (works better for hydrate notations like CuSO4.5H2O).
        for (const candidate of candidates) {
            const cid = await fetchFirstCidByNameQuery(candidate);
            if (!cid) continue;

            const prop = await fetchProperties(cid);
            return {
                cid,
                smiles: prop?.smiles || undefined
            };
        }

        return null;
    } catch (error) {
        console.error("PubChem formula lookup error:", error);
        return null;
    }
}

/**
 * Queries PubChem database for chemical information by name or identifier.
 *
 * Performs a multi-step API call sequence:
 * 1. Search for Compound ID (CID) by chemical name
 * 2. Fetch molecular properties (formula, weight, IUPAC name, SMILES)
 * 3. Fetch synonyms (common names, trade names)
 * 4. Identify best formula representation from synonyms
 *
 * @async
 * @param {string} query - Chemical name or identifier
 * @returns {Promise<Partial<ChemicalData> | null>} Chemical data object or null
 */
export async function lookupPubChem(query: string): Promise<Partial<ChemicalData> | null> {
    try {
        // Step 1: Search for Compound ID (CID) by name
        const searchRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`
        );

        if (!searchRes.ok) return null;
        const searchData = (await searchRes.json()) as CidSearchResponse;
        const cid = searchData.IdentifierList?.CID?.[0];
        if (!cid) return null;

        // Step 2: Fetch molecular properties
        const prop = await fetchProperties(cid);
        if (!prop) return null;

        // Step 3: Fetch synonyms
        const synRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`
        );
        const synonymsData = synRes.ok ? ((await synRes.json()) as SynonymsResponse) : undefined;
        const synonyms: string[] = synonymsData?.InformationList?.Information?.[0]?.Synonym ?? [];

        // Step 4: Identify the best formula
        let bestFormula = prop.MolecularFormula;
        try {
            const baseComp = parseFormula(bestFormula);
            const formulaCandidates = synonyms.filter(s => {
                if (!/[A-Z]/.test(s)) return false;
                if (/[a-z]{3,}/.test(s)) return false;
                try {
                    const comp = parseFormula(s);
                    return areCompositionsEqual(baseComp, comp);
                } catch {
                    return false;
                }
            });

            if (formulaCandidates.length > 0) {
                const score = (f: string) => {
                    let s = f.length;
                    if (f.includes("OH")) s += 10;
                    if (f.includes("COOH")) s += 10;
                    if (f.includes("NH2")) s += 10;
                    if (f.includes("CH3")) s += 10;
                    if (f.includes("(")) s += 5;
                    return s;
                };
                formulaCandidates.sort((a, b) => score(b) - score(a));
                bestFormula = formulaCandidates[0];
            }
        } catch (e) {
            console.error("Formula selection error:", e);
        }

        return {
            cid,
            mw: Number.parseFloat(Number.parseFloat(prop.MolecularWeight).toFixed(2)),
            formula: normalizeFormula(bestFormula, false),
            name: prop.IUPACName,
            smiles: prop.smiles || undefined,
            synonyms,
        };
    } catch (error) {
        console.error("PubChem API error:", error);
        return null;
    }
}
