import { describe, expect, it } from "vitest";
import { formatDensity, lookupDensityForCompound } from "@/lib/chemistry/density";

describe("density lookup", () => {
    it("finds density by CID", () => {
        expect(lookupDensityForCompound({ cid: 702 })).toBeCloseTo(0.789);
    });

    it("finds density by normalized name", () => {
        expect(lookupDensityForCompound({ name: "Glacial Acetic Acid" })).toBeCloseTo(1.049);
    });

    it("finds density by formula fallback", () => {
        expect(lookupDensityForCompound({ formula: "C2H6O" })).toBeCloseTo(0.789);
    });

    it("formats density for display/editing", () => {
        expect(formatDensity(0.789123)).toBe("0.7891");
    });

    it("prioritizes custom CID entries over built-in values", () => {
        expect(
            lookupDensityForCompound(
                { cid: 702 },
                [{ cid: 702, name: "Ethanol custom", density: 0.8 }]
            )
        ).toBeCloseTo(0.8);
    });

    it("finds concentrated solution reagent densities by name", () => {
        expect(lookupDensityForCompound({ name: "28% ammonia solution" })).toBeCloseTo(0.9);
        expect(lookupDensityForCompound({ name: "50% sodium hydroxide solution" })).toBeCloseTo(1.53);
        expect(lookupDensityForCompound({ name: "70% perchloric acid" })).toBeCloseTo(1.67);
        expect(lookupDensityForCompound({ name: "85% phosphoric acid" })).toBeCloseTo(1.685);
        expect(lookupDensityForCompound({ name: "96-98% sulfuric acid" })).toBeCloseTo(1.84);
    });
});
