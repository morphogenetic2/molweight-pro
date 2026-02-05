import { describe, it, expect } from "vitest";
import { getUnitLabel, getUnitType, parseValueWithUnit } from "@/lib/chemistry/units";


describe("units", () => {
    it("returns labels", () => {
        expect(getUnitLabel("mL")).toBe("mL");
        expect(getUnitLabel("pct")).toBe("%");
        expect(getUnitLabel("unknown")).toBe("unknown");
    });

    it("returns unit types", () => {
        expect(getUnitType("g")).toBe("mass");
        expect(getUnitType("mL")).toBe("volume");
        expect(getUnitType("mM")).toBe("molar");
        expect(getUnitType("mg/mL")).toBe("mass_conc");
        expect(getUnitType("pct")).toBe("percent");
        expect(getUnitType("nonsense")).toBe("unknown");
    });

    it("parses value with unit tokens", () => {
        expect(parseValueWithUnit("10 mM", ["M", "mM"])).toEqual({ value: "10", unit: "mM" });
        expect(parseValueWithUnit("2% ", ["pct"])).toEqual({ value: "2", unit: "pct" });
        expect(parseValueWithUnit("500uL", ["mL", "μL", "L"])).toEqual({ value: "500", unit: "μL" });
        expect(parseValueWithUnit("3x", ["dil"])).toEqual({ value: "3", unit: "dil" });
    });
});
