import { describe, expect, it } from "vitest";
import {
    buildDilutionConcentrationMap,
    buildOrderedDilutionFactors,
    buildPerceptualShadeStyles,
    buildSequentialDilutionSteps,
    detectLaneReplicateSuggestions,
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

    it("applies overage linearly to total prepared volume", () => {
        const steps = buildSequentialDilutionSteps({
            orderedFactors: [
                { wellId: "A1", factor: 2 },
                { wellId: "A2", factor: 2 },
                { wellId: "A3", factor: 2 },
                { wellId: "A4", factor: 2 },
            ],
            startConcentration: 100,
            perWellVolume: 100,
            extraCount: 0,
            overagePercent: 20,
        });

        const totalPreparedAcrossSteps = steps.reduce((sum, step) => sum + step.dispenseVolume, 0);
        expect(totalPreparedAcrossSteps).toBeCloseTo(480, 6);
    });

    it("detects monotonic increases within a contiguous chain segment", () => {
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

    it("does not compare across BLANK-separated segments in the same lane", () => {
        const wellIds = ["A2", "B2", "C2", "D2", "E2", "F2", "G2", "H2"];
        const wellValues = {
            A2: "2",
            B2: "1",
            C2: "BLANK",
            D2: "100",
            E2: "80",
            F2: "60",
            G2: "40",
            H2: "30",
        };

        const violations = findMonotonicIncreaseViolations({
            entries: [
                { wellId: "A2", concentration: 2 },
                { wellId: "B2", concentration: 1 },
                { wellId: "D2", concentration: 100 },
                { wellId: "E2", concentration: 80 },
                { wellId: "F2", concentration: 60 },
                { wellId: "G2", concentration: 40 },
                { wellId: "H2", concentration: 30 },
            ],
            wellIds,
            wellValues,
            cols: 1,
            fillMode: "column",
            isBlank,
        });

        expect(violations).toHaveLength(0);
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

    it("detects adjacent-lane replicate suggestions for a monotonic dilution series", () => {
        const wellIds = [
            "A1", "A2",
            "B1", "B2",
            "C1", "C2",
            "D1", "D2",
            "E1", "E2",
        ];
        const wellValues = {
            A1: "1:2",
            B1: "1:3",
            C1: "1:3",
            D1: "1:2",
            E1: "BLANK",
        };

        const suggestions = detectLaneReplicateSuggestions({
            wellIds,
            wellValues,
            rows: 5,
            cols: 2,
            fillMode: "column",
            mode: "dilution",
            startConcentration: 100,
            isBlank,
            parseDilutionFactor,
            parseConcentration: () => null,
        });

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].sourceLane).toBe(0);
        expect(suggestions[0].targetLane).toBe(1);
        expect(suggestions[0].sourceLanes).toEqual([0]);
        expect(suggestions[0].targetLanes).toEqual([1]);
        expect(suggestions[0].writes.map((write) => write.targetWellId)).toEqual(["A2", "B2", "C2", "D2", "E2"]);
    });

    it("detects overflowing multi-lane series and replicates full span", () => {
        const wellIds = [
            "A1", "A2", "A3", "A4",
            "B1", "B2", "B3", "B4",
            "C1", "C2", "C3", "C4",
            "D1", "D2", "D3", "D4",
        ];
        const wellValues = {
            A1: "100",
            B1: "80",
            C1: "60",
            D1: "40",
            A2: "20",
            B2: "10",
            C2: "BLANK",
        };

        const suggestions = detectLaneReplicateSuggestions({
            wellIds,
            wellValues,
            rows: 4,
            cols: 4,
            fillMode: "column",
            mode: "concentration",
            startConcentration: 100,
            isBlank,
            parseDilutionFactor,
            parseConcentration: (raw) => {
                const parsed = Number.parseFloat(raw);
                return Number.isFinite(parsed) ? parsed : null;
            },
        });

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].sourceLanes).toEqual([0, 1]);
        expect(suggestions[0].targetLanes).toEqual([2, 3]);
        expect(suggestions[0].lanePairs).toEqual([
            { sourceLane: 0, targetLane: 2 },
            { sourceLane: 1, targetLane: 3 },
        ]);
        expect(suggestions[0].writes.map((write) => write.targetWellId)).toEqual([
            "A3", "B3", "C3", "D3", "A4", "B4", "C4",
        ]);
    });

    it("does not suggest replication for non-monotonic concentration series", () => {
        const wellIds = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"];
        const wellValues = {
            A1: "100",
            B1: "80",
            C1: "90",
            D1: "BLANK",
        };

        const suggestions = detectLaneReplicateSuggestions({
            wellIds,
            wellValues,
            rows: 4,
            cols: 2,
            fillMode: "column",
            mode: "concentration",
            startConcentration: 100,
            isBlank,
            parseDilutionFactor,
            parseConcentration: (raw) => {
                const parsed = Number.parseFloat(raw);
                return Number.isFinite(parsed) ? parsed : null;
            },
        });

        expect(suggestions).toHaveLength(0);
    });
});
