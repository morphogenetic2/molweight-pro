import { ChemicalData, parseFormula, areCompositionsEqual, normalizeFormula } from "./parser";

export async function lookupPubChem(query: string): Promise<Partial<ChemicalData> | null> {
    try {
        // 1. Search for CID
        const searchRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`
        );
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json();
        const cid = searchData.IdentifierList.CID[0];

        // 2. Fetch properties
        const propRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`
        );
        if (!propRes.ok) return null;
        const propData = await propRes.json();
        const prop = propData.PropertyTable.Properties[0];

        // 3. Fetch synonyms
        const synRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`
        );
        const synonyms: string[] = synRes.ok ? (await synRes.json()).InformationList.Information[0].Synonym : [];

        // 4. Identify the best formula
        // Default is what PubChem gives as MolecularFormula (Hill system, usually compact)
        let bestFormula = prop.MolecularFormula;
        try {
            const baseComp = parseFormula(bestFormula);

            // Filter synonyms for those that look like formulas and match composition
            const formulaCandidates = synonyms.filter(s => {
                // Heuristic: Must contain letters and numbers, maybe dots/brackets, NO spaces
                // But we allow spaces now because our parser handles them
                if (!/[A-Z]/.test(s)) return false;
                if (/[a-z]{3,}/.test(s)) return false; // Common words likely have 3+ lowercase letters
                
                try {
                    const comp = parseFormula(s);
                    return areCompositionsEqual(baseComp, comp);
                } catch {
                    return false;
                }
            });

            if (formulaCandidates.length > 0) {
                // Sort candidates to find the most "expanded" one
                // Heuristics:
                // - Contains OH, COOH, NH2, CH3, etc.
                // - Longer string (more likely expanded)
                // - Breaking Hill system 
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
            mw: parseFloat(parseFloat(prop.MolecularWeight).toFixed(2)),
            formula: normalizeFormula(bestFormula, false), // Store as clean but standardizable
            name: prop.IUPACName,
            synonyms,
        };
    } catch (error) {
        console.error("PubChem lookup error:", error);
        return null;
    }
}
