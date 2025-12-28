import { ChemicalData } from "./parser";

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
        const synonyms = synRes.ok ? (await synRes.json()).InformationList.Information[0].Synonym : [];

        return {
            cid,
            mw: parseFloat(prop.MolecularWeight),
            formula: prop.MolecularFormula,
            name: prop.IUPACName,
            synonyms,
        };
    } catch (error) {
        console.error("PubChem lookup error:", error);
        return null;
    }
}
