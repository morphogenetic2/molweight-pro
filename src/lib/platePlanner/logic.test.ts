import { describe, expect, it } from "vitest";
import {
    buildDilutionConcentrationMap,
    buildOrderedDilutionFactors,
    buildPerceptualShadeStyles,
    buildSequentialDilutionSteps,
    findMonotonicIncreaseViolations,
    type WellShadeStyle,
} from "@/lib/platePlanner/logic";
import { parseDilutionFactor } from "@/lib/chemistry/dilution";

const isBlank = (raw: string) => raw.trim().toUpperCase() === "BLANK";

describe("plate planner logic", () => {
    it("orders dilution factors farthest from BLANK first", () => {
        const wellIds = ["A1", "B1", "C1", "D1", "E1"];
        const wellValues = {
            A1: "1:2",
            B1: "1:3",
            C1: "1:3",
            D1: "1:2",
            E1: "BLANK",
        };

        const result = buildOrderedDilutionFactors({
            wellIds,
            wellValues,
            cols: 1,
            isBlank,
            parseDilutionFactor,
        });

        expect(result.blankOrderingApplied).toBe(true);
        expect(result.ordered.map((entry) => entry.wellId)).toEqual(["A1", "B1", "C1", "D1"]);
    });

    it("builds sequential dilution steps with cumulative concentration", () => {
        const steps = buildSequentialDilutionSteps({
            orderedFactors: [
                { wellId: "A1", factor: 2 },
                { wellId: "B1", factor: 3 },
                { wellId: "C1", factor: 3 },
            ],
            startConcentration: 100,
            perWellVolume: 100,
            extraCount: 0,
            overagePercent: 0,
        });

        expect(steps).toHaveLength(3);
        expect(steps.map((step) => step.cumulativeFactor)).toEqual([2, 6, 18]);
        expect(steps[0].finalConcentration).toBeCloseTo(50, 6);
        expect(steps[1].finalConcentration).toBeCloseTo(100 / 6, 6);
        expect(steps[2].finalConcentration).toBeCloseTo(100 / 18, 6);
        expect(steps[0].transferToNext).toBeGreaterThan(0);
        expect(steps[2].transferToNext).toBe(0);
    });

    it("detects monotonic increases toward BLANK in chain order", () => {
        const wellIds = ["A1", "B1", "C1", "D1", "E1"];
        const wellValues = {
            A1: "100",
            B1: "80",
            C1: "90",
            D1: "70",
            E1: "BLANK",
        };

        const violations = findMonotonicIncreaseViolations({
            entries: [
                { wellId: "A1", concentration: 100 },
                { wellId: "B1", concentration: 80 },
                { wellId: "C1", concentration: 90 },
                { wellId: "D1", concentration: 70 },
            ],
            wellIds,
            wellValues,
            cols: 1,
            fillMode: "column",
            isBlank,
        });

        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            previousWellId: "B1",
            currentWellId: "C1",
        });
    });

    it("computes cumulative lane concentrations for replicated columns", () => {
        const wellIds = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2", "E1", "E2"];
        const wellValues = {
            A1: "1:2",
            A2: "1:2",
            B1: "1:3",
            B2: "1:3",
            C1: "1:3",
            C2: "1:3",
            D1: "1:2",
            D2: "1:2",
            E1: "BLANK",
            E2: "BLANK",
        };

        const result = buildDilutionConcentrationMap({
            wellIds,
            wellValues,
            cols: 2,
            fillMode: "column",
            startConcentration: 100,
            isBlank,
            parseDilutionFactor,
        });

        expect(result.concentrationByWell.get("A1")).toBeCloseTo(50, 6);
        expect(result.concentrationByWell.get("A2")).toBeCloseTo(50, 6);
        expect(result.concentrationByWell.get("B1")).toBeCloseTo(100 / 6, 6);
        expect(result.concentrationByWell.get("B2")).toBeCloseTo(100 / 6, 6);
        expect(result.concentrationByWell.get("C1")).toBeCloseTo(100 / 18, 6);
        expect(result.concentrationByWell.get("C2")).toBeCloseTo(100 / 18, 6);
    });

    it("applies perceptual shade bins and lets BLANK override style", () => {
        const blankStyle: WellShadeStyle = {
            backgroundColor: "rgba(1, 2, 3, 0.4)",
            borderColor: "rgba(4, 5, 6, 0.4)",
        };

        const styles = buildPerceptualShadeStyles({
            concentrationByWell: new Map<string, number>([
                ["A1", 100],
                ["B1", 10],
                ["C1", 1],
            ]),
            blankWellIds: new Set<string>(["B1"]),
            paletteHexLowToHigh: ["#111111", "#333333", "#777777"],
            backgroundAlpha: 0.3,
            borderAlpha: 0.7,
            blankStyle,
        });

        expect(styles.get("B1")).toEqual(blankStyle);
        expect(styles.get("A1")?.backgroundColor).not.toEqual(styles.get("C1")?.backgroundColor);
    });
});
