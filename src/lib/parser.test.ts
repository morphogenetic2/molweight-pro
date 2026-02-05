import { describe, it, expect } from "vitest";
import { parseFormula, calculateMw } from "@/lib/parser";


describe("parser", () => {
    it("parses simple formulas", () => {
        expect(parseFormula("H2O")).toEqual({ H: 2, O: 1 });
        expect(parseFormula("NaCl")).toEqual({ Na: 1, Cl: 1 });
    });

    it("parses parentheses and hydrates", () => {
        expect(parseFormula("Al2(SO4)3")).toEqual({ Al: 2, S: 3, O: 12 });
        expect(parseFormula("CuSO4·5H2O")).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    });

    it("throws on invalid formulas", () => {
        expect(() => parseFormula("Xy2")).toThrow();
        expect(() => parseFormula("H2O)" )).toThrow();
    });
});

describe("calculateMw", () => {
    it("calculates known molecular weights", () => {
        const waterMw = calculateMw(parseFormula("H2O"));
        expect(waterMw).toBeCloseTo(18.015, 2);

        const naclMw = calculateMw(parseFormula("NaCl"));
        expect(naclMw).toBeCloseTo(58.44, 1);
    });
});
