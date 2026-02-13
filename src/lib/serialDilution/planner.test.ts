import { describe, expect, it } from "vitest";
import { buildSerialPlan } from "@/lib/serialDilution/planner";

const BASE_INPUT = {
    mode: "auto" as const,
    seriesType: "dilution" as const,
    autoStopMode: "target" as const,
    stockConcentration: "100",
    startConcentration: "100",
    targetConcentration: "10",
    targetConcentrationUnit: "mM",
    concentrationUnit: "mM",
    finalVolume: "1000",
    volumeUnit: "uL",
    replicates: 1,
    overagePercent: 0,
    includeBlank: false,
    stepCount: 4,
    autoDilutionFactor: "1:2",
    autoConcentrationStep: "10",
    customStepInputs: ["1:2", "1:2", "1:2", "1:2"],
};

describe("buildSerialPlan", () => {
    it("keeps auto dilution target mode above target when exact hit is not possible", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            targetConcentration: "15",
            autoDilutionFactor: "1:2",
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps).toHaveLength(2);
        expect(plan.finalConcentration).toBe(25);
        expect(plan.targetAbove).toBe(true);
        expect(plan.targetExact).toBe(false);
    });

    it("applies overage as one replicate safety margin", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            autoStopMode: "steps",
            stepCount: 1,
            replicates: 3,
            overagePercent: 10,
        });

        expect(plan.errors).toEqual([]);
        expect(plan.preparedVolumePerStep).toBeCloseTo(3100);
    });

    it("includes carry-over volume so each step can feed the next dilution", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            autoStopMode: "steps",
            stepCount: 2,
            autoDilutionFactor: "1:2",
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps).toHaveLength(2);
        expect(plan.steps[1]?.transferVolume).toBeCloseTo(500);
        expect(plan.steps[1]?.diluentVolume).toBeCloseTo(500);
        expect(plan.steps[0]?.transferVolume).toBeCloseTo(750);
        expect(plan.steps[0]?.diluentVolume).toBeCloseTo(750);
    });

    it("supports blanks and 1:1 custom dilution steps", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            mode: "custom",
            seriesType: "dilution",
            stepCount: 3,
            customStepInputs: ["1:2", "blank", "1:1"],
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps).toHaveLength(3);
        expect(plan.steps[1]?.isBlank).toBe(true);
        expect(plan.steps[2]?.toConcentration).toBeCloseTo(50);
    });

    it("keeps carry-over accounting across blank rows", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            mode: "custom",
            seriesType: "dilution",
            stepCount: 3,
            customStepInputs: ["1:2", "blank", "1:2"],
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps[0]?.transferVolume).toBeCloseTo(750);
        expect(plan.steps[1]?.isBlank).toBe(true);
        expect(plan.steps[1]?.transferVolume).toBeCloseTo(0);
        expect(plan.steps[2]?.transferVolume).toBeCloseTo(500);
    });

    it("parses custom concentration inputs with explicit units", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            mode: "custom",
            seriesType: "concentration",
            stepCount: 2,
            customStepInputs: ["0.08 M", "60 mM"],
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps).toHaveLength(2);
        expect(plan.steps[0]?.toConcentration).toBeCloseTo(80);
        expect(plan.steps[1]?.toConcentration).toBeCloseTo(60);
    });

    it("applies carry-over volume in custom concentration mode", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            mode: "custom",
            seriesType: "concentration",
            stepCount: 3,
            customStepInputs: ["50 mM", "25 mM", "12.5 mM"],
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps).toHaveLength(3);
        expect(plan.steps[2]?.transferVolume).toBeCloseTo(500);
        expect(plan.steps[1]?.transferVolume).toBeCloseTo(750);
        expect(plan.steps[0]?.transferVolume).toBeCloseTo(875);
    });

    it("supports target concentration in a different unit than the start concentration", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            startConcentration: "100",
            concentrationUnit: "mM",
            targetConcentration: "50",
            targetConcentrationUnit: "uM",
            autoDilutionFactor: "1:2",
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps).toHaveLength(10);
        expect(plan.finalConcentration).toBeCloseTo(0.09765625);
        expect(plan.targetAbove).toBe(true);
    });

    it("builds Step 0 as an explicit stock-to-start pre-dilution", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            stockConcentration: "150",
            startConcentration: "100",
            autoDilutionFactor: "1:2",
            targetConcentration: "40",
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps[0]?.isPreparation).toBe(true);
        expect(plan.steps[0]?.stepLabel).toBe("0");
        expect(plan.steps[0]?.ratio).toBe("1:1.5");
        expect(plan.steps[0]?.fromConcentration).toBeCloseTo(150);
        expect(plan.steps[0]?.toConcentration).toBeCloseTo(100);
        expect(plan.steps[1]?.isPreparation).toBe(false);
        expect(plan.steps[1]?.fromConcentration).toBeCloseTo(100);
        expect(plan.steps[1]?.toConcentration).toBeCloseTo(50);
    });

    it("does not create Step 0 when stock equals start", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            stockConcentration: "100",
            startConcentration: "100",
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps.some((step) => step.isPreparation)).toBe(false);
    });

    it("keeps cumulative dilution inclusive of pre-dilution", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            stockConcentration: "150",
            startConcentration: "100",
            autoDilutionFactor: "1:2",
            targetConcentration: "40",
        });

        expect(plan.errors).toEqual([]);
        expect(plan.steps[0]?.cumulativeFactor).toBeCloseTo(1.5);
        expect(plan.steps[1]?.cumulativeFactor).toBeCloseTo(3);
    });

    it("treats blank rows as pure diluent rows without inherited concentration metadata", () => {
        const plan = buildSerialPlan({
            ...BASE_INPUT,
            includeBlank: true,
        });

        expect(plan.errors).toEqual([]);
        const blank = plan.steps.find((step) => step.isBlank);
        expect(blank).toBeDefined();
        expect(blank?.fromConcentration).toBeNull();
        expect(blank?.cumulativeFactor).toBeNull();
        expect(blank?.transferVolume).toBe(0);
    });
});
