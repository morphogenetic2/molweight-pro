import { describe, expect, it } from "vitest";
import { parseDilutionFactor } from "@/lib/chemistry/dilution";

describe("parseDilutionFactor", () => {
    it("parses supported dilution formats", () => {
        expect(parseDilutionFactor("2")).toBe(2);
        expect(parseDilutionFactor("x4")).toBe(4);
        expect(parseDilutionFactor("1:10")).toBe(10);
        expect(parseDilutionFactor("1/5")).toBe(5);
        expect(parseDilutionFactor("2:8")).toBe(4);
        expect(parseDilutionFactor("  1 : 2  ")).toBe(2);
        expect(parseDilutionFactor("\u00d73")).toBe(3);
    });

    it("rejects invalid or non-dilution factors", () => {
        expect(parseDilutionFactor("")).toBeNull();
        expect(parseDilutionFactor("1")).toBeNull();
        expect(parseDilutionFactor("x1")).toBeNull();
        expect(parseDilutionFactor("2:1")).toBeNull();
        expect(parseDilutionFactor("0:2")).toBeNull();
        expect(parseDilutionFactor("abc")).toBeNull();
    });
});
