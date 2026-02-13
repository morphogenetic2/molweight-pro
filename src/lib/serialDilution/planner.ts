import { parseDilutionFactor } from "@/lib/chemistry/dilution";
import {
    MASS_CONC_UNITS,
    MOLAR_UNITS,
    PERCENT_UNITS,
    convertUnitValue,
    parseValueWithUnit,
} from "@/lib/chemistry/units";
import type { SerialAutoStopMode, SerialDilutionMode, SerialSeriesType } from "@/store/storeTypes";

export interface SerialPlanInput {
    mode: SerialDilutionMode;
    seriesType: SerialSeriesType;
    autoStopMode: SerialAutoStopMode;
    stockConcentration: string;
    startConcentration: string;
    targetConcentration: string;
    targetConcentrationUnit: string;
    concentrationUnit: string;
    finalVolume: string;
    volumeUnit: string;
    replicates: number;
    overagePercent: number;
    includeBlank: boolean;
    stepCount: number;
    autoDilutionFactor: string;
    autoConcentrationStep: string;
    customStepInputs: string[];
}

export interface SerialPlanStep {
    key: string;
    stepLabel: string;
    ratio: string;
    factor: number | null;
    fromConcentration: number | null;
    toConcentration: number | null;
    transferVolume: number;
    diluentVolume: number;
    cumulativeFactor: number | null;
    isBlank: boolean;
    isPreparation: boolean;
}

export interface SerialPlanResult {
    errors: string[];
    steps: SerialPlanStep[];
    preparedVolumePerStep: number | null;
    totalDiluent: number;
    stockNeeded: number;
    finalConcentration: number | null;
    target: number | null;
    targetExact: boolean;
    targetAbove: boolean;
    aliquotCount: number;
}

const MAX_STEPS = 200;
const BLANK_TOKENS = new Set(["0", "b", "blank"]);
const CONC_UNITS = [
    ...Object.keys(MOLAR_UNITS),
    ...Object.keys(MASS_CONC_UNITS),
    ...Object.keys(PERCENT_UNITS),
];

function parsePositiveNumber(raw: string): number | null {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function parseTargetInBaseUnit(value: string, fromUnit: string, baseUnit: string): number | null {
    const parsed = parsePositiveNumber(value);
    if (!parsed) return null;
    const converted = convertUnitValue(parsed, fromUnit, baseUnit);
    if (converted === null || !Number.isFinite(converted) || converted <= 0) {
        return null;
    }
    return converted;
}

function isBlankToken(raw: string): boolean {
    return BLANK_TOKENS.has(raw.trim().toLowerCase());
}

function ratioLabel(factor: number): string {
    const rounded = Math.round(factor);
    if (Math.abs(factor - rounded) < 1e-9) {
        return `1:${rounded}`;
    }
    return `1:${Number.parseFloat(factor.toPrecision(6))}`;
}

function parseDilutionFactorAllowIdentity(raw: string): number | null {
    const token = raw
        .trim()
        .toLowerCase()
        .replace(/[\u00d7*]/g, "x")
        .replace(/\s+/g, "");
    if (!token) return null;

    const simpleMatch = token.match(/^x?(\d*\.?\d+)$/);
    if (simpleMatch) {
        const factor = Number.parseFloat(simpleMatch[1]);
        return factor >= 1 ? factor : null;
    }

    const oneToNMatch = token.match(/^1[:/](\d*\.?\d+)$/);
    if (oneToNMatch) {
        const factor = Number.parseFloat(oneToNMatch[1]);
        return factor >= 1 ? factor : null;
    }

    const ratioMatch = token.match(/^(\d*\.?\d+)[:/](\d*\.?\d+)$/);
    if (!ratioMatch) return null;

    const left = Number.parseFloat(ratioMatch[1]);
    const right = Number.parseFloat(ratioMatch[2]);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
        return null;
    }

    const factor = right / left;
    return factor >= 1 ? factor : null;
}

export function normalizeCustomDilutionToken(raw: string): string {
    if (isBlankToken(raw)) return "BLANK";
    const factor = parseDilutionFactorAllowIdentity(raw);
    if (!factor) return raw.trim();
    return ratioLabel(factor);
}

export function resizeCustomStepInputs(inputs: string[], stepCount: number): string[] {
    return Array.from({ length: stepCount }, (_, index) => inputs[index] ?? "");
}

function parseConcentrationInput(
    raw: string,
    defaultUnit: string
): { blank: boolean; value: number; unit: string; baseValue: number } | { error: string } {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { error: "Value is empty." };
    }

    if (isBlankToken(trimmed)) {
        return { blank: true, value: 0, unit: defaultUnit, baseValue: 0 };
    }

    const parsed = parseValueWithUnit(trimmed, CONC_UNITS);
    const numeric = Number.parseFloat(parsed.value);
    if (!Number.isFinite(numeric)) {
        return { error: "Invalid concentration value." };
    }

    if (numeric === 0) {
        return { blank: true, value: 0, unit: defaultUnit, baseValue: 0 };
    }

    if (numeric < 0) {
        return { error: "Concentration must be zero or greater." };
    }

    const hasUnitToken = /[a-zA-Z%μµ/]/.test(trimmed.replace(parsed.value, "").trim());
    if (hasUnitToken && !parsed.unit) {
        return { error: "Unknown concentration unit." };
    }

    const unit = parsed.unit ?? defaultUnit;
    const baseValue = convertUnitValue(numeric, unit, defaultUnit);
    if (baseValue === null) {
        return { error: "Could not convert concentration unit to the selected base unit." };
    }

    return { blank: false, value: numeric, unit, baseValue };
}

function buildDilutionStep(params: {
    stepLabel: string;
    factor: number;
    fromConcentration: number;
    cumulativeFactor: number;
    key: string;
    isPreparation?: boolean;
}): SerialPlanStep {
    const {
        stepLabel,
        factor,
        fromConcentration,
        cumulativeFactor,
        key,
        isPreparation = false,
    } = params;
    const toConcentration = fromConcentration / factor;
    return {
        key,
        stepLabel,
        ratio: ratioLabel(factor),
        factor,
        fromConcentration,
        toConcentration,
        transferVolume: 0,
        diluentVolume: 0,
        cumulativeFactor,
        isBlank: false,
        isPreparation,
    };
}

function buildPreparationStep(params: {
    stockConcentration: number;
    startConcentration: number;
    cumulativeFactor: number;
}): SerialPlanStep {
    const factor = params.stockConcentration / params.startConcentration;
    return {
        key: "step-prep",
        stepLabel: "0",
        ratio: ratioLabel(factor),
        factor,
        fromConcentration: params.stockConcentration,
        toConcentration: params.startConcentration,
        transferVolume: 0,
        diluentVolume: 0,
        cumulativeFactor: params.cumulativeFactor,
        isBlank: false,
        isPreparation: true,
    };
}

function buildBlankStep(params: {
    stepLabel: string;
    preparedVolumePerStep: number;
    key: string;
}): SerialPlanStep {
    return {
        key: params.key,
        stepLabel: params.stepLabel,
        ratio: "BLANK",
        factor: null,
        fromConcentration: null,
        toConcentration: 0,
        transferVolume: 0,
        diluentVolume: params.preparedVolumePerStep,
        cumulativeFactor: null,
        isBlank: true,
        isPreparation: false,
    };
}

function assignStepVolumes(steps: SerialPlanStep[], dispenseVolumePerStep: number): SerialPlanStep[] {
    let transferNeededByNextStep = 0;

    for (let index = steps.length - 1; index >= 0; index -= 1) {
        const step = steps[index];
        if (!step) continue;

        if (step.isBlank) {
            step.transferVolume = 0;
            step.diluentVolume = dispenseVolumePerStep;
            continue;
        }

        const factor = step.factor;
        if (!factor || factor <= 0) {
            step.transferVolume = 0;
            step.diluentVolume = 0;
            transferNeededByNextStep = 0;
            continue;
        }

        const requiredStepVolume = dispenseVolumePerStep + transferNeededByNextStep;
        const transferVolume = requiredStepVolume / factor;
        const diluentVolume = requiredStepVolume - transferVolume;

        step.transferVolume = transferVolume;
        step.diluentVolume = diluentVolume;
        transferNeededByNextStep = transferVolume;
    }

    return steps;
}

function initialResult(errors: string[], preparedVolumePerStep: number | null, aliquotCount: number): SerialPlanResult {
    return {
        errors,
        steps: [],
        preparedVolumePerStep,
        totalDiluent: 0,
        stockNeeded: 0,
        finalConcentration: null,
        target: null,
        targetExact: false,
        targetAbove: false,
        aliquotCount,
    };
}

export function buildSerialPlan(input: SerialPlanInput): SerialPlanResult {
    const errors: string[] = [];

    const stock = parsePositiveNumber(input.stockConcentration);
    const start = parsePositiveNumber(input.startConcentration);
    const finalVolume = parsePositiveNumber(input.finalVolume);
    const replicates = Number.isInteger(input.replicates) && input.replicates >= 1 ? input.replicates : 1;
    const overagePercent = [0, 5, 10, 20].includes(input.overagePercent) ? input.overagePercent : 0;
    const stepCount = Number.isInteger(input.stepCount) ? input.stepCount : 0;
    const aliquotCount = replicates;

    if (!stock) {
        errors.push("Stock concentration must be a number greater than zero.");
    }
    if (!start) {
        errors.push("Start concentration must be a number greater than zero.");
    }
    if (stock && start && stock < start) {
        errors.push("Stock concentration must be greater than or equal to start concentration.");
    }
    if (!finalVolume) {
        errors.push("Final volume per step must be a number greater than zero.");
    }
    if (stepCount < 1 || stepCount > MAX_STEPS) {
        errors.push(`Step count must be between 1 and ${MAX_STEPS}.`);
    }

    const preparedVolumePerStep =
        finalVolume && replicates > 0
            ? finalVolume * (replicates + overagePercent / 100)
            : null;

    if (errors.length > 0 || !start || !preparedVolumePerStep) {
        return initialResult(errors, preparedVolumePerStep, aliquotCount);
    }

    let currentConcentration = start;
    let currentCumulative = 1;
    const generatedSteps: SerialPlanStep[] = [];

    const addDilutionStep = (stepLabel: string, factor: number, key: string, isPreparation = false) => {
        currentCumulative *= factor;
        const step = buildDilutionStep({
            stepLabel,
            factor,
            fromConcentration: currentConcentration,
            cumulativeFactor: currentCumulative,
            key,
            isPreparation,
        });
        currentConcentration = step.toConcentration ?? currentConcentration;
        generatedSteps.push(step);
    };

    const addBlankStep = (stepLabel: string, key: string) => {
        generatedSteps.push(
            buildBlankStep({
                stepLabel,
                preparedVolumePerStep,
                key,
            })
        );
    };

    if (stock && stock > start) {
        const stockToStartFactor = stock / start;
        currentCumulative *= stockToStartFactor;
        generatedSteps.push(
            buildPreparationStep({
                stockConcentration: stock,
                startConcentration: start,
                cumulativeFactor: currentCumulative,
            })
        );
    }

    let target: number | null = null;
    if (input.mode === "auto") {
        if (input.seriesType === "dilution") {
            const factor = parseDilutionFactor(input.autoDilutionFactor);
            if (!factor) {
                errors.push("Auto dilution factor must be a valid dilution like 1:2, 1:10, or x4.");
            } else if (input.autoStopMode === "steps") {
                for (let index = 0; index < stepCount; index += 1) {
                    addDilutionStep(String(index + 1), factor, `step-${index + 1}`);
                }
            } else {
                target = parseTargetInBaseUnit(
                    input.targetConcentration,
                    input.targetConcentrationUnit,
                    input.concentrationUnit
                );
                if (!target) {
                    errors.push("Target concentration must be a number greater than zero (with compatible units).");
                } else if (start <= target) {
                    errors.push("Target concentration must be lower than start concentration.");
                } else {
                    let index = 0;
                    const tolerance = Math.max(target * 1e-9, 1e-12);
                    while (index < MAX_STEPS) {
                        const candidate = currentConcentration / factor;
                        if (candidate < target - tolerance) {
                            break;
                        }
                        addDilutionStep(String(index + 1), factor, `step-${index + 1}`);
                        index += 1;
                        if (Math.abs(currentConcentration - target) <= tolerance) {
                            break;
                        }
                    }
                    if (index === 0) {
                        errors.push("No valid dilution step can stay above the target. Lower the factor or use step-count mode.");
                    }
                }
            }
        } else {
            const decrement = parsePositiveNumber(input.autoConcentrationStep);
            if (!decrement) {
                errors.push("Concentration step must be a number greater than zero.");
            } else if (input.autoStopMode === "steps") {
                for (let index = 0; index < stepCount; index += 1) {
                    const next = currentConcentration - decrement;
                    if (next <= 0) {
                        errors.push("Concentration step would make values zero or negative. Reduce steps or step size.");
                        break;
                    }
                    const factor = currentConcentration / next;
                    addDilutionStep(String(index + 1), factor, `step-${index + 1}`);
                }
            } else {
                target = parseTargetInBaseUnit(
                    input.targetConcentration,
                    input.targetConcentrationUnit,
                    input.concentrationUnit
                );
                if (!target) {
                    errors.push("Target concentration must be a number greater than zero (with compatible units).");
                } else if (start <= target) {
                    errors.push("Target concentration must be lower than start concentration.");
                } else {
                    let index = 0;
                    const tolerance = Math.max(target * 1e-9, 1e-12);
                    while (index < MAX_STEPS) {
                        const next = currentConcentration - decrement;
                        if (next < target - tolerance) {
                            break;
                        }
                        if (next <= 0) {
                            errors.push("Concentration step would make values zero or negative.");
                            break;
                        }
                        const factor = currentConcentration / next;
                        addDilutionStep(String(index + 1), factor, `step-${index + 1}`);
                        index += 1;
                        if (Math.abs(currentConcentration - target) <= tolerance) {
                            break;
                        }
                    }
                    if (index === 0 && errors.length === 0) {
                        errors.push("No concentration step can be generated above the target. Reduce step size or use step-count mode.");
                    }
                }
            }
        }
    } else {
        const inputs = resizeCustomStepInputs(input.customStepInputs, stepCount);
        for (let index = 0; index < stepCount; index += 1) {
            const raw = inputs[index] ?? "";
            const stepLabel = String(index + 1);
            if (!raw.trim()) {
                errors.push(`Step ${stepLabel}: value is required.`);
                continue;
            }

            if (isBlankToken(raw)) {
                addBlankStep(stepLabel, `step-${stepLabel}`);
                continue;
            }

            if (input.seriesType === "dilution") {
                const factor = parseDilutionFactorAllowIdentity(raw);
                if (!factor) {
                    errors.push(`Step ${stepLabel}: dilution must be 1:n (n >= 1).`);
                    continue;
                }
                addDilutionStep(stepLabel, factor, `step-${stepLabel}`);
                continue;
            }

            const parsed = parseConcentrationInput(raw, input.concentrationUnit);
            if ("error" in parsed) {
                errors.push(`Step ${stepLabel}: ${parsed.error}`);
                continue;
            }
            if (parsed.blank) {
                addBlankStep(stepLabel, `step-${stepLabel}`);
                continue;
            }

            const tolerance = Math.max(currentConcentration * 1e-9, 1e-12);
            if (parsed.baseValue > currentConcentration + tolerance) {
                errors.push(`Step ${stepLabel}: concentration must be lower than or equal to the previous step.`);
                continue;
            }

            const factor = currentConcentration / parsed.baseValue;
            addDilutionStep(stepLabel, factor, `step-${stepLabel}`);
        }
    }

    if (input.includeBlank && errors.length === 0) {
        addBlankStep("Blank", "step-blank");
    }

    if (errors.length > 0) {
        return initialResult(errors, preparedVolumePerStep, aliquotCount);
    }

    const hydratedSteps = assignStepVolumes(generatedSteps, preparedVolumePerStep);

    const totalDiluent = hydratedSteps.reduce((sum, step) => sum + step.diluentVolume, 0);
    const prepStep = hydratedSteps.find((step) => step.isPreparation);
    const firstTransfer = hydratedSteps.find((step) => !step.isBlank && !step.isPreparation);
    const stockNeeded = prepStep?.transferVolume ?? firstTransfer?.transferVolume ?? 0;
    const finalNonBlankStep = [...hydratedSteps].reverse().find((step) => !step.isBlank);
    const finalConcentration = finalNonBlankStep?.toConcentration ?? start;
    const targetTolerance = target ? Math.max(target * 1e-9, 1e-12) : 0;
    const targetExact = target !== null && finalConcentration !== null
        ? Math.abs(finalConcentration - target) <= targetTolerance
        : false;
    const targetAbove = target !== null && finalConcentration !== null
        ? finalConcentration > target + targetTolerance
        : false;

    return {
        errors,
        steps: hydratedSteps,
        preparedVolumePerStep,
        totalDiluent,
        stockNeeded,
        finalConcentration,
        target,
        targetExact,
        targetAbove,
        aliquotCount,
    };
}
