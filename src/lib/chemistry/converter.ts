import {
    MASS_UNITS, VOLUME_UNITS, MOLAR_UNITS, MASS_CONC_UNITS, PERCENT_UNITS,
    getUnitType, UnitType
} from './units';

/**
 * Normalizes any value to its base SI unit (g, L, M, g/L, ratio).
 */
export function normalize(value: number, unit: string): number {
    if (unit in MASS_UNITS) return value * MASS_UNITS[unit].factor; // -> g
    if (unit in VOLUME_UNITS) return value * VOLUME_UNITS[unit].factor; // -> L
    if (unit in MOLAR_UNITS) return value * MOLAR_UNITS[unit].factor; // -> M
    if (unit in MASS_CONC_UNITS) return value * MASS_CONC_UNITS[unit].factor; // -> g/L
    if (unit in PERCENT_UNITS) return value * PERCENT_UNITS[unit].factor; // -> ratio (0.01)
    return NaN;
}

/**
 * Denormalizes a base SI value into the target unit.
 */
export function denormalize(baseValue: number, unit: string): number {
    if (unit in MASS_UNITS) return baseValue / MASS_UNITS[unit].factor;
    if (unit in VOLUME_UNITS) return baseValue / VOLUME_UNITS[unit].factor;
    if (unit in MOLAR_UNITS) return baseValue / MOLAR_UNITS[unit].factor;
    if (unit in MASS_CONC_UNITS) return baseValue / MASS_CONC_UNITS[unit].factor;
    if (unit in PERCENT_UNITS) return baseValue / PERCENT_UNITS[unit].factor;
    return NaN;
}

/**
 * Converts a concentration value (M, g/L, %) to Molarity (M).
 * Requires MW for mass-based units.
 */
export function toMolarity(value: number, unit: string, mw: number): number {
    const type = getUnitType(unit);
    const base = normalize(value, unit); // M, g/L, or ratio

    switch (type) {
        case 'molar':
            return base; // Already M
        case 'mass_conc':
            // g/L -> M = (g/L) / MW
            return mw > 0 ? base / mw : 0;
        case 'percent':
            // Ratio -> M. 
            // 1% (0.01) = 1g/100mL = 10g/L.
            // g/L = ratio * 1000? No. 
            // 100% = 1.0 = 1000g/L (roughly density of water).
            // So g/L = ratio * 1000.
            // M = (ratio * 1000) / MW.
            return mw > 0 ? (base * 1000) / mw : 0;
        default:
            return 0;
    }
}

/**
 * Converts a concentration value to Mass Concentration (g/L).
 */
export function toMassConcentration(value: number, unit: string, mw: number): number {
    const type = getUnitType(unit);
    const base = normalize(value, unit);

    switch (type) {
        case 'mass_conc':
            return base; // Already g/L
        case 'percent':
            // Ratio -> g/L. 1.0 = 1000 g/L.
            return base * 1000;
        case 'molar':
            // M -> g/L = M * MW
            return base * mw;
        default:
            return 0;
    }
}

/**
 * Universal solvent. Solves for X.
 */
export const Solver = {
    // Mass = Conc * Vol * MW
    solveMass: (conc: number, concUnit: string, vol: number, volUnit: string, mw: number): number => {
        const volL = normalize(vol, volUnit);
        // We calculate mass in grams
        // Approaches:
        // 1. Convert conc to g/L. Mass = (g/L) * L.
        const concGL = toMassConcentration(conc, concUnit, mw);
        return concGL * volL; // g
    },

    // Vol = Mass / Conc
    solveVolume: (mass: number, massUnit: string, conc: number, concUnit: string, mw: number): number => {
        const massG = normalize(mass, massUnit);
        const concGL = toMassConcentration(conc, concUnit, mw);
        if (concGL === 0) return 0;
        return massG / concGL; // L
    },

    // Conc = Mass / Vol
    solveConcentration: (mass: number, massUnit: string, vol: number, volUnit: string, targetUnit: string, mw: number): number => {
        const massG = normalize(mass, massUnit);
        const volL = normalize(vol, volUnit);
        if (volL === 0) return 0;

        const concGL = massG / volL; // g/L

        // Now convert g/L to target unit
        const targetType = getUnitType(targetUnit);
        if (targetType === 'molar') {
            const molar = mw > 0 ? concGL / mw : 0;
            return denormalize(molar, targetUnit);
        } else if (targetType === 'percent') {
            const ratio = concGL / 1000;
            return denormalize(ratio, targetUnit);
        } else {
            // mass_conc
            return denormalize(concGL, targetUnit);
        }
    }
};
