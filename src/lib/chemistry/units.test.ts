import { describe, it, expect } from "vitest";
import { convertUnitValue, getUnitLabel, getUnitType, parseValueWithUnit } from "@/lib/chemistry/units";


describe("units", () => {
    it("returns labels", () => {
        expect(getUnitLabel("mL")).toBe("mL");
        expect(getUnitLabel("pct")).toBe("%");
        expect(getUnitLabel("dil")).toBe("x");
        expect(getUnitLabel("unknown")).toBe("unknown");
    });

    it("returns unit types", () => {
        expect(getUnitType("g")).toBe("mass");
        expect(getUnitType("mL")).toBe("volume");
        expect(getUnitType("mM")).toBe("molar");
        expect(getUnitType("mg/mL")).toBe("mass_conc");
        expect(getUnitType("pct")).toBe("percent");
        expect(getUnitType("dil")).toBe("dilution");
        expect(getUnitType("nonsense")).toBe("unknown");
    });

    it("parses value with unit tokens", () => {
        expect(parseValueWithUnit("10 mM", ["M", "mM"])).toEqual({ value: "10", unit: "mM" });
        expect(parseValueWithUnit("2% ", ["pct"])).toEqual({ value: "2", unit: "pct" });
        expect(parseValueWithUnit("500uL", ["mL", "μL", "L"])).toEqual({ value: "500", unit: "μL" });
        expect(parseValueWithUnit("3x", ["dil"])).toEqual({ value: "3", unit: "dil" });
        expect(parseValueWithUnit("50X", ["dil"])).toEqual({ value: "50", unit: "dil" });
    });

    it("converts same-domain units", () => {
        expect(convertUnitValue(1, "M", "mM")).toBe(1000);
        expect(convertUnitValue(500, "mL", "L")).toBe(0.5);
        expect(convertUnitValue(1, "mg/mL", "g/L")).toBe(1);
        expect(convertUnitValue(50, "dil", "dil")).toBe(50);
    });

    it("converts cross-domain concentration units with MW", () => {
        // 1 M NaCl (58.44 g/mol) -> 58.44 g/L
        expect(convertUnitValue(1, "M", "g/L", 58.44)).toBeCloseTo(58.44, 6);
        // 58.44 g/L NaCl -> 1 M
        expect(convertUnitValue(58.44, "g/L", "M", 58.44)).toBeCloseTo(1, 6);
        // 1% w/v -> 10 g/L
        expect(convertUnitValue(1, "pct", "g/L")).toBeCloseTo(10, 6);
    });

    it("returns null when conversion is not possible", () => {
        expect(convertUnitValue(1, "M", "g/L")).toBeNull();
        expect(convertUnitValue(1, "mL", "mM")).toBeNull();
        expect(convertUnitValue(1, "dil", "M")).toBeNull();
    });
});
