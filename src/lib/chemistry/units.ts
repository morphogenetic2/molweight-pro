export type UnitType = 'mass' | 'volume' | 'molar' | 'mass_conc' | 'percent';

export interface UnitConfig {
    label: string;
    factor: number; // Multiplier to get to base unit (g, L, M, g/L, or raw ratio)
}

export const MASS_UNITS: Record<string, UnitConfig> = {
    'kg': { label: 'kg', factor: 1000 },
    'g': { label: 'g', factor: 1 },
    'mg': { label: 'mg', factor: 1e-3 },
    'μg': { label: 'μg', factor: 1e-6 },
    'ug': { label: 'μg', factor: 1e-6 }, // alias
    'ng': { label: 'ng', factor: 1e-9 },
};

export const VOLUME_UNITS: Record<string, UnitConfig> = {
    'L': { label: 'L', factor: 1 },
    'mL': { label: 'mL', factor: 1e-3 },
    'μL': { label: 'μL', factor: 1e-6 },
    'uL': { label: 'μL', factor: 1e-6 }, // alias
    'nL': { label: 'nL', factor: 1e-9 },
};

// Base: Molar (M)
export const MOLAR_UNITS: Record<string, UnitConfig> = {
    'M': { label: 'M', factor: 1 },
    'mM': { label: 'mM', factor: 1e-3 },
    'μM': { label: 'μM', factor: 1e-6 },
    'uM': { label: 'μM', factor: 1e-6 },
    'nM': { label: 'nM', factor: 1e-9 },
};

// Base: g/L
export const MASS_CONC_UNITS: Record<string, UnitConfig> = {
    'g/L': { label: 'g/L', factor: 1 },
    'mg/mL': { label: 'mg/mL', factor: 1 }, // 1 mg/mL = 1 g/L
    'mg/L': { label: 'mg/L', factor: 1e-3 },
    'μg/mL': { label: 'μg/mL', factor: 1e-3 },
    'ug/mL': { label: 'μg/mL', factor: 1e-3 },
    'ng/μL': { label: 'ng/μL', factor: 1e-3 },
};

// Base: Ratio (1.0 = 100%)
export const PERCENT_UNITS: Record<string, UnitConfig> = {
    'pct': { label: '%', factor: 0.01 }, // 1% = 0.01
};

export const ALL_UNITS = {
    ...MASS_UNITS,
    ...VOLUME_UNITS,
    ...MOLAR_UNITS,
    ...MASS_CONC_UNITS,
    ...PERCENT_UNITS,
};

// Helpers for UI
export function getUnitLabel(unit: string): string {
    return ALL_UNITS[unit]?.label || unit;
}

export function getUnitType(unit: string): UnitType | 'unknown' {
    if (unit in MASS_UNITS) return 'mass';
    if (unit in VOLUME_UNITS) return 'volume';
    if (unit in MOLAR_UNITS) return 'molar';
    if (unit in MASS_CONC_UNITS) return 'mass_conc';
    if (unit in PERCENT_UNITS) return 'percent';
    return 'unknown';
}
