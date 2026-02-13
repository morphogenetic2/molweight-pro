/**
 * Approximate liquid densities at room temperature (~20-25 C), in g/mL.
 * Values are intended for practical lab planning, not regulatory specification.
 */

const DENSITY_BY_CID: Record<number, number> = {
    962: 0.997,   // Water
    702: 0.789,   // Ethanol
    887: 0.792,   // Methanol
    3776: 0.786,  // Isopropanol (2-propanol)
    180: 0.785,   // Acetone
    6342: 0.786,  // Acetonitrile
    679: 1.095,   // DMSO
    753: 1.261,   // Glycerol
    176: 1.049,   // Acetic acid
    284: 1.22,    // Formic acid
    8471: 0.726,  // Triethylamine
    1140: 0.867,  // Toluene
    6228: 0.944,  // DMF
    6344: 1.326,  // Dichloromethane
    6212: 1.489,  // Chloroform
    8058: 0.655,  // Hexane
    8857: 0.902,  // Ethyl acetate
    8003: 0.626,  // Pentane
    3283: 0.713,  // Diethyl ether
    1049: 0.983,  // Pyridine
    222: 0.9,     // Ammonia, aqueous
    313: 1.18,    // Hydrochloric acid, aqueous
    944: 1.42,    // Nitric acid, 70% solution
    
};

function normalizeKey(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

export interface DensityLookupEntry {
    cid: number;
    name?: string;
    density: number;
}

const DENSITY_BY_NAME: Record<string, number> = {
    water: 0.997,
    h2o: 0.997,
    ethanol: 0.789,
    ethylalcohol: 0.789,
    methanol: 0.792,
    isopropanol: 0.786,
    isopropylalcohol: 0.786,
    propan2ol: 0.786,
    acetone: 0.785,
    acetonitrile: 0.786,
    dmso: 1.095,
    dimethylsulfoxide: 1.095,
    glycerol: 1.261,
    glycerin: 1.261,
    aceticacid: 1.049,
    glacialaceticacid: 1.049,
    formicacid: 1.22,
    triethylamine: 0.726,
    toluene: 0.867,
    dmf: 0.944,
    dimethylformamide: 0.944,
    dichloromethane: 1.326,
    methylenechloride: 1.326,
    chloroform: 1.489,
    hexane: 0.655,
    ethylacetate: 0.902,
    // Common concentrated aqueous reagents
    "28ammoniasolution": 0.9,
    "28ammoniumhydroxidesolution": 0.9,
    "ammoniasolution28": 0.9,
    "50sodiumhydroxidesolution": 1.53,
    "50naohsolution": 1.53,
    "70perchloricacid": 1.67,
    "70perchloricacidsolution": 1.67,
    "85phosphoricacid": 1.685,
    "85phosphoricacidsolution": 1.685,
    "9698sulfuricacid": 1.84,
    "9698sulfuricacidsolution": 1.84,
    "96sulfuricacid": 1.84,
    "98sulfuricacid": 1.84,
    "concentratedsulfuricacid": 1.84,
};

const DENSITY_BY_FORMULA: Record<string, number> = {
    H2O: 0.997,
    C2H6O: 0.789,
    CH4O: 0.792,
    C3H8O: 0.786,
    C3H6O: 0.785,
    C2H3N: 0.786,
    C2H6OS: 1.095,
    C3H8O3: 1.261,
    C2H4O2: 1.049,
    CH2O2: 1.22,
    C6H15N: 0.726,
    C7H8: 0.867,
    C3H7NO: 0.944,
    CH2Cl2: 1.326,
    CHCl3: 1.489,
    C6H14: 0.655,
    C4H8O2: 0.902,
};

export function formatDensity(densityGPerMl: number): string {
    if (!Number.isFinite(densityGPerMl) || densityGPerMl <= 0) return "";
    return Number.parseFloat(densityGPerMl.toPrecision(4)).toString();
}

export function lookupDensityForCompound(input: {
    cid?: number;
    name?: string;
    formula?: string;
}, customEntries: DensityLookupEntry[] = []): number | null {
    const normalizedCustomEntries = customEntries.filter(
        (entry) =>
            Number.isInteger(entry.cid) &&
            entry.cid > 0 &&
            Number.isFinite(entry.density) &&
            entry.density > 0
    );

    if (typeof input.cid === "number" && Number.isFinite(input.cid)) {
        const byCustomCid = normalizedCustomEntries.find((entry) => entry.cid === input.cid);
        if (byCustomCid) {
            return byCustomCid.density;
        }

        const byCid = DENSITY_BY_CID[input.cid];
        if (typeof byCid === "number") {
            return byCid;
        }
    }

    if (input.name) {
        const normalizedName = normalizeKey(input.name);
        const byCustomName = normalizedCustomEntries.find(
            (entry) => entry.name && normalizeKey(entry.name) === normalizedName
        );
        if (byCustomName) {
            return byCustomName.density;
        }

        const byName = DENSITY_BY_NAME[normalizeKey(input.name)];
        if (typeof byName === "number") {
            return byName;
        }
    }

    if (input.formula) {
        const byFormula = DENSITY_BY_FORMULA[input.formula.replace(/\s+/g, "").toUpperCase()];
        if (typeof byFormula === "number") {
            return byFormula;
        }
    }

    return null;
}
