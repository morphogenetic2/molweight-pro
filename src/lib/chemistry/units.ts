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

/**
 * Convert a numeric value between supported units.
 *
 * Supports:
 * - Same-domain conversions (mass, volume, molar, mass_conc, percent)
 * - Cross-domain concentration conversions between molar <-> mass_conc <-> percent
 *   (requires `mw` for conversions that involve molarity).
 *
 * Returns `null` when conversion is not possible.
 */
export function convertUnitValue(
    value: number,
    fromUnit: string,
    toUnit: string,
    mw?: number
): number | null {
    if (!Number.isFinite(value)) return null;
    if (fromUnit === toUnit) return value;

    const fromType = getUnitType(fromUnit);
    const toType = getUnitType(toUnit);

    if (fromType === "unknown" || toType === "unknown") {
        return null;
    }

    // Same-domain conversion is direct normalize -> denormalize.
    if (fromType === toType) {
        const fromCfg = ALL_UNITS[fromUnit];
        const toCfg = ALL_UNITS[toUnit];
        if (!fromCfg || !toCfg) return null;
        const base = value * fromCfg.factor;
        return base / toCfg.factor;
    }

    const isConc = (t: UnitType | "unknown") =>
        t === "molar" || t === "mass_conc" || t === "percent";

    if (!isConc(fromType) || !isConc(toType)) {
        return null;
    }

    const fromCfg = ALL_UNITS[fromUnit];
    const toCfg = ALL_UNITS[toUnit];
    if (!fromCfg || !toCfg) return null;

    // Intermediate base for concentration conversions: g/L.
    let gPerL: number | null = null;
    if (fromType === "mass_conc") {
        gPerL = value * fromCfg.factor;
    } else if (fromType === "percent") {
        const ratio = value * fromCfg.factor;
        gPerL = ratio * 1000;
    } else if (fromType === "molar") {
        if (!mw || mw <= 0) return null;
        const molar = value * fromCfg.factor;
        gPerL = molar * mw;
    }

    if (gPerL === null || !Number.isFinite(gPerL)) {
        return null;
    }

    if (toType === "mass_conc") {
        return gPerL / toCfg.factor;
    }

    if (toType === "percent") {
        const ratio = gPerL / 1000;
        return ratio / toCfg.factor;
    }

    if (toType === "molar") {
        if (!mw || mw <= 0) return null;
        const molar = gPerL / mw;
        return molar / toCfg.factor;
    }

    return null;
}

const normalizeUnitKey = (unit: string): string =>
    unit
        .trim()
        .replace(/µ/g, "μ")
        .replace(/u/g, "μ")
        .replace(/\s+/g, "")
        .toLowerCase();

const matchUnitToken = (token: string, allowedUnits: string[]): string | undefined => {
    const normalizedToken = normalizeUnitKey(token);
    if (!normalizedToken) return undefined;

    if ((normalizedToken === "%" || normalizedToken === "percent" || normalizedToken === "pct")
        && allowedUnits.includes("pct")) {
        return "pct";
    }

    if ((normalizedToken === "x" || normalizedToken === "dil" || normalizedToken === "dilution")
        && allowedUnits.includes("dil")) {
        return "dil";
    }

    return allowedUnits.find((unit) => normalizeUnitKey(unit) === normalizedToken);
};

export function parseValueWithUnit(input: string, allowedUnits: string[]): { value: string; unit?: string } {
    const raw = input.trim();
    if (!raw) return { value: "" };

    const match = raw.match(
        /^([-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?)\s*([^\d\s].*)?$/
    );

    if (!match) {
        return { value: raw };
    }

    const value = match[1];
    const unitToken = match[5]?.trim();
    const unit = unitToken ? matchUnitToken(unitToken, allowedUnits) : undefined;
    return { value, unit };
}
