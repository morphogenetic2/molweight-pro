"use client";

import { useMemo, useState } from "react";
import { AlertCircle, LayoutGrid, WandSparkles } from "lucide-react";
import { convertUnitValue, getUnitLabel, parseValueWithUnit } from "@/lib/chemistry/units";
import { ValueUnitInput } from "@/components/ui/ValueUnitInput";
import { useToastStore } from "@/store/useToastStore";

type PlannerMode = "dilution" | "concentration";
type FillMode = "column" | "row";
type FillDirection = "right" | "left" | "down" | "up";
type PreparationMethod = "direct" | "serial";

interface PlatePreset {
    key: string;
    label: string;
    rows: number;
    cols: number;
}

interface WellEntry {
    wellId: string;
    raw: string;
    normalizedInput: string;
    dilutionFactor: number;
    finalValue: number;
    finalUnit: string;
    finalDisplay: string;
    warning?: string;
}

interface ConditionSummary {
    key: string;
    label: string;
    wells: number;
    dilutionFactor: number;
    finalDisplay: string;
    dispensedVolume: number;
    preparedVolume: number;
    transferFromStart: number;
    diluentVolume: number;
    canPrepareFromStart: boolean;
}

interface PlateAnalysis {
    errors: string[];
    warnings: string[];
    entries: WellEntry[];
    summaries: ConditionSummary[];
    blankWells: number;
    blankDispensedVolume: number;
    blankPreparedVolume: number;
}

interface SerialInstruction {
    key: string;
    sourceLabel: string;
    stepFactor: number;
    transferVolume: number;
    diluentVolume: number;
    fromStart: boolean;
    dispenseVolume: number;
    requiredTotalVolume: number;
    transferToNext: number;
}

interface Coord {
    row: number;
    col: number;
}

const PLATE_PRESETS: PlatePreset[] = [
    { key: "P6", label: "P6 (2x3)", rows: 2, cols: 3 },
    { key: "P12", label: "P12 (3x4)", rows: 3, cols: 4 },
    { key: "P24", label: "P24 (4x6)", rows: 4, cols: 6 },
    { key: "P48", label: "P48 (6x8)", rows: 6, cols: 8 },
    { key: "P96", label: "P96 (8x12)", rows: 8, cols: 12 },
    { key: "P384", label: "P384 (16x24)", rows: 16, cols: 24 },
];

const CONCENTRATION_UNITS = [
    "M",
    "mM",
    "μM",
    "nM",
    "g/L",
    "mg/mL",
    "mg/L",
    "μg/mL",
    "ng/μL",
    "pct",
];

const VOLUME_UNITS = ["μL", "mL"];
const BLANK_TOKEN = "BLANK";

function parsePositiveNumber(raw: string): number | null {
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
}

function parseNonNegativeInteger(raw: string): number | null {
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
}

function parsePositiveInteger(raw: string): number | null {
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
}

function formatNumber(value: number, digits = 6): string {
    if (!Number.isFinite(value)) return "-";
    if (value === 0) return "0";
    if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e6) {
        return value.toExponential(3);
    }
    return Number.parseFloat(value.toPrecision(digits)).toString();
}

function ratioLabel(factor: number): string {
    const rounded = Math.round(factor);
    if (Math.abs(factor - rounded) < 1e-9) {
        return `1:${rounded}`;
    }
    return `1:${formatNumber(factor, 5)}`;
}

function formatVolumeWithAutoMicro(value: number, unit: string): string {
    const inMl = convertUnitValue(value, unit, "mL");
    if (inMl !== null && inMl > 0 && inMl < 1) {
        const inUl = convertUnitValue(value, unit, "μL");
        if (inUl !== null && Number.isFinite(inUl)) {
            return `${formatNumber(inUl)} μL`;
        }
    }
    return `${formatNumber(value)} ${getUnitLabel(unit)}`;
}

function getWellInputWidthCh(value: string): number {
    const trimmedLength = value.trim().length;
    return Math.min(24, Math.max(12, trimmedLength || 12));
}

function parseDilutionFactor(raw: string): number | null {
    const token = raw
        .trim()
        .toLowerCase()
        .replace(/[×*]/g, "x")
        .replace(/\s+/g, "");
    if (!token) return null;

    const numeric = token.match(/^x?(\d*\.?\d+)$/);
    if (numeric) {
        const factor = Number.parseFloat(numeric[1]);
        return factor > 1 ? factor : null;
    }

    const oneToN = token.match(/^1[:/](\d*\.?\d+)$/);
    if (oneToN) {
        const factor = Number.parseFloat(oneToN[1]);
        return factor > 1 ? factor : null;
    }

    const ratio = token.match(/^(\d*\.?\d+)[:/](\d*\.?\d+)$/);
    if (!ratio) return null;

    const left = Number.parseFloat(ratio[1]);
    const right = Number.parseFloat(ratio[2]);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
        return null;
    }
    const factor = right / left;
    return factor > 1 ? factor : null;
}

function isBlankAlias(raw: string): boolean {
    const token = raw.trim().toLowerCase();
    if (!token) return false;
    if (token === "blank" || token === "b") return true;

    const parsed = parseValueWithUnit(raw.trim(), CONCENTRATION_UNITS);
    const numeric = Number.parseFloat(parsed.value);
    return Number.isFinite(numeric) && numeric === 0;
}

function isCanonicalBlank(raw: string): boolean {
    return raw.trim().toUpperCase() === BLANK_TOKEN;
}

function parseConcentrationToken(raw: string, fallbackUnit: string): { value: number; unit: string } | null {
    const parsed = parseValueWithUnit(raw.trim(), CONCENTRATION_UNITS);
    const value = Number.parseFloat(parsed.value);
    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }
    const unit = parsed.unit ?? fallbackUnit;
    if (!CONCENTRATION_UNITS.includes(unit)) {
        return null;
    }
    return { value, unit };
}

function indexToRowLabel(index: number): string {
    let n = index;
    let label = "";
    do {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
}

function buildWellIds(rows: number, cols: number): string[] {
    const ids: string[] = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            ids.push(`${indexToRowLabel(row)}${col + 1}`);
        }
    }
    return ids;
}

function getCoord(index: number, cols: number): Coord {
    return {
        row: Math.floor(index / cols),
        col: index % cols,
    };
}

function toIndex(coord: Coord, cols: number): number {
    return coord.row * cols + coord.col;
}

function getSourceBoundingBox(sourceCoords: Coord[]): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
    return sourceCoords.reduce(
        (acc, coord) => ({
            minRow: Math.min(acc.minRow, coord.row),
            maxRow: Math.max(acc.maxRow, coord.row),
            minCol: Math.min(acc.minCol, coord.col),
            maxCol: Math.max(acc.maxCol, coord.col),
        }),
        { minRow: Number.POSITIVE_INFINITY, maxRow: Number.NEGATIVE_INFINITY, minCol: Number.POSITIVE_INFINITY, maxCol: Number.NEGATIVE_INFINITY }
    );
}

function areArraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function rowsMatchReplicateGroups(matrix: string[][], replicates: number): boolean {
    if (replicates <= 1) return true;
    if (matrix.length % replicates !== 0) return false;

    for (let groupStart = 0; groupStart < matrix.length; groupStart += replicates) {
        const reference = matrix[groupStart];
        for (let offset = 1; offset < replicates; offset += 1) {
            if (!areArraysEqual(reference, matrix[groupStart + offset])) {
                return false;
            }
        }
    }
    return true;
}

function columnsMatchReplicateGroups(matrix: string[][], replicates: number): boolean {
    if (replicates <= 1) return true;
    const width = matrix[0]?.length ?? 0;
    if (width === 0) return true;
    if (width % replicates !== 0) return false;

    for (let groupStart = 0; groupStart < width; groupStart += replicates) {
        for (let offset = 1; offset < replicates; offset += 1) {
            for (let row = 0; row < matrix.length; row += 1) {
                if (matrix[row][groupStart] !== matrix[row][groupStart + offset]) {
                    return false;
                }
            }
        }
    }
    return true;
}

export default function PlatePlannerCalculator() {
    const { push } = useToastStore();

    const [plateKey, setPlateKey] = useState("P96");
    const [mode, setMode] = useState<PlannerMode>("dilution");
    const [fillMode, setFillMode] = useState<FillMode>("column");
    const [fillDirection, setFillDirection] = useState<FillDirection>("right");

    const [stockValue, setStockValue] = useState("1");
    const [stockUnit, setStockUnit] = useState("M");
    const [startValue, setStartValue] = useState("0.5");
    const [startUnit, setStartUnit] = useState("M");

    const [replicates, setReplicates] = useState("2");
    const [extraSamples, setExtraSamples] = useState("0");
    const [overagePercent, setOveragePercent] = useState("10");

    const [perWellVolume, setPerWellVolume] = useState("100");
    const [perWellVolumeUnit, setPerWellVolumeUnit] = useState("μL");

    const [wellValues, setWellValues] = useState<Record<string, string>>({});
    const [fillFeedback, setFillFeedback] = useState<string | null>(null);
    const [preparationMethod, setPreparationMethod] = useState<PreparationMethod>("direct");

    const plate = PLATE_PRESETS.find((entry) => entry.key === plateKey) ?? PLATE_PRESETS[4];
    const wellIds = useMemo(() => buildWellIds(plate.rows, plate.cols), [plate.rows, plate.cols]);

    const filledWellIds = useMemo(
        () => wellIds.filter((wellId) => (wellValues[wellId] ?? "").trim() !== ""),
        [wellIds, wellValues]
    );

    const sourcePatternHint = useMemo(() => {
        if (filledWellIds.length === 0) {
            return null;
        }
        const replicateCount = parsePositiveInteger(replicates) ?? 1;
        if (replicateCount <= 1) {
            return null;
        }

        const sourceCoords = filledWellIds
            .map((wellId) => wellIds.indexOf(wellId))
            .filter((idx) => idx >= 0)
            .map((idx) => getCoord(idx, plate.cols));
        if (sourceCoords.length === 0) {
            return null;
        }
        const bounds = getSourceBoundingBox(sourceCoords);
        const height = bounds.maxRow - bounds.minRow + 1;
        const width = bounds.maxCol - bounds.minCol + 1;

        const matrix: string[][] = [];
        for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
            const rowValues: string[] = [];
            for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
                const idx = toIndex({ row, col }, plate.cols);
                const wellId = wellIds[idx];
                rowValues.push((wellValues[wellId] ?? "").trim());
            }
            matrix.push(rowValues);
        }

        if (fillMode === "column" && width > 1) {
            if (columnsMatchReplicateGroups(matrix, replicateCount)) {
                return null;
            }
            return "Current filled block spans multiple columns. If this came from overflow (for example 9 values in an 8-row plate), switch to row-wise replicate fill.";
        }
        if (fillMode === "row" && height > 1) {
            if (rowsMatchReplicateGroups(matrix, replicateCount)) {
                return null;
            }
            return "Current filled block spans multiple rows. If this came from overflow, switch to column-wise replicate fill.";
        }
        return null;
    }, [fillMode, filledWellIds, plate.cols, replicates, wellIds, wellValues]);

    const analysis = useMemo<PlateAnalysis>(() => {
        const errors: string[] = [];
        const warnings: string[] = [];

        const startConcentration = parsePositiveNumber(startValue);
        const stockConcentration = parsePositiveNumber(stockValue);
        const replicateCount = parsePositiveInteger(replicates);
        const extraCount = parseNonNegativeInteger(extraSamples);
        const overage = Number.parseFloat(overagePercent);
        const perWell = parsePositiveNumber(perWellVolume);

        if (!startConcentration) {
            errors.push("Start concentration must be a number greater than zero.");
        }
        if (!stockConcentration) {
            errors.push("Stock concentration must be a number greater than zero.");
        }
        if (!replicateCount) {
            errors.push("Replicates must be an integer greater than zero.");
        }
        if (extraCount === null) {
            errors.push("Extra samples must be an integer of zero or higher.");
        }
        if (!Number.isFinite(overage) || overage < 0) {
            errors.push("Overage must be zero or greater.");
        }
        if (!perWell) {
            errors.push("Per-well volume must be a number greater than zero.");
        }

        if (startConcentration && stockConcentration) {
            const stockInStartUnit = convertUnitValue(stockConcentration, stockUnit, startUnit);
            if (stockInStartUnit === null) {
                warnings.push("Stock and start concentrations use incompatible unit families. Keep both in comparable units.");
            } else if (stockInStartUnit < startConcentration) {
                warnings.push("Stock concentration is lower than start concentration. That is not a dilution setup.");
            }
        }

        const entries: WellEntry[] = [];
        let blankWells = 0;

        for (const wellId of filledWellIds) {
            const raw = (wellValues[wellId] ?? "").trim();
            if (!raw) continue;
            if (isBlankAlias(raw) || isCanonicalBlank(raw)) {
                blankWells += 1;
                continue;
            }

            if (!startConcentration) {
                continue;
            }

            if (mode === "dilution") {
                const factor = parseDilutionFactor(raw);
                if (factor === null) {
                    warnings.push(`${wellId}: invalid dilution "${raw}". Accepted formats are 1:2, x2, or 2, and factor must be > 1.`);
                    continue;
                }
                const finalInStartUnit = startConcentration / factor;
                entries.push({
                    wellId,
                    raw,
                    normalizedInput: ratioLabel(factor),
                    dilutionFactor: factor,
                    finalValue: finalInStartUnit,
                    finalUnit: startUnit,
                    finalDisplay: `${formatNumber(finalInStartUnit)} ${getUnitLabel(startUnit)}`,
                });
                continue;
            }

            const parsed = parseConcentrationToken(raw, startUnit);
            if (!parsed) {
                warnings.push(`${wellId}: invalid concentration "${raw}". Use values like 1M, 20 uM, 10 mM, 1 mg/mL.`);
                continue;
            }

            const finalInStartUnit = convertUnitValue(parsed.value, parsed.unit, startUnit);
            if (finalInStartUnit === null) {
                warnings.push(`${wellId}: concentration unit ${getUnitLabel(parsed.unit)} cannot be compared with start unit ${getUnitLabel(startUnit)}.`);
                continue;
            }

            const factor = startConcentration / finalInStartUnit;
            const warning =
                factor < 1
                    ? `${wellId}: target concentration ${formatNumber(parsed.value)} ${getUnitLabel(parsed.unit)} is higher than start concentration ${formatNumber(startConcentration)} ${getUnitLabel(startUnit)}.`
                    : undefined;
            if (warning) {
                warnings.push(warning);
            }

            entries.push({
                wellId,
                raw,
                normalizedInput: `${formatNumber(parsed.value)} ${getUnitLabel(parsed.unit)}`,
                dilutionFactor: factor,
                finalValue: parsed.value,
                finalUnit: parsed.unit,
                finalDisplay: `${formatNumber(parsed.value)} ${getUnitLabel(parsed.unit)}`,
                warning,
            });
        }

        const summaryMap = new Map<string, ConditionSummary>();
        const safeExtra = extraCount ?? 0;
        const safeOverage = Number.isFinite(overage) && overage >= 0 ? overage : 0;
        const safePerWell = perWell ?? 0;
        const safeReplicateCount = replicateCount ?? 1;

        const computePreparedVolume = (wellCount: number): number => {
            if (wellCount <= 0) return 0;
            const replicateSets = Math.max(1, Math.ceil(wellCount / safeReplicateCount));
            return safePerWell * (wellCount + safeExtra * replicateSets) * (1 + safeOverage / 100);
        };

        for (const entry of entries) {
            const key = mode === "dilution"
                ? `d:${ratioLabel(entry.dilutionFactor)}`
                : `c:${entry.finalDisplay}`;
            const label = mode === "dilution"
                ? ratioLabel(entry.dilutionFactor)
                : entry.finalDisplay;
            const existing = summaryMap.get(key);
            if (existing) {
                existing.wells += 1;
                existing.dispensedVolume = safePerWell * existing.wells;
                existing.preparedVolume = computePreparedVolume(existing.wells);
                existing.canPrepareFromStart = existing.dilutionFactor >= 1;
                existing.transferFromStart = existing.canPrepareFromStart
                    ? existing.preparedVolume / Math.max(existing.dilutionFactor, 1e-12)
                    : 0;
                existing.diluentVolume = Math.max(existing.preparedVolume - existing.transferFromStart, 0);
            } else {
                const preparedVolume = computePreparedVolume(1);
                const canPrepareFromStart = entry.dilutionFactor >= 1;
                const transferFromStart = canPrepareFromStart
                    ? preparedVolume / Math.max(entry.dilutionFactor, 1e-12)
                    : 0;
                const diluentVolume = Math.max(preparedVolume - transferFromStart, 0);
                summaryMap.set(key, {
                    key,
                    label,
                    wells: 1,
                    dilutionFactor: entry.dilutionFactor,
                    finalDisplay: entry.finalDisplay,
                    dispensedVolume: safePerWell,
                    preparedVolume,
                    transferFromStart,
                    diluentVolume,
                    canPrepareFromStart,
                });
            }
        }

        const summaries = Array.from(summaryMap.values()).sort((a, b) => a.dilutionFactor - b.dilutionFactor);
        const blankDispensedVolume = safePerWell * blankWells;
        const blankPreparedVolume = computePreparedVolume(blankWells);

        return {
            errors,
            warnings,
            entries,
            summaries,
            blankWells,
            blankDispensedVolume,
            blankPreparedVolume,
        };
    }, [
        extraSamples,
        filledWellIds,
        mode,
        overagePercent,
        perWellVolume,
        replicates,
        startUnit,
        startValue,
        stockUnit,
        stockValue,
        wellValues,
    ]);

    const serialInstructions = useMemo(() => {
        const eligible = analysis.summaries
            .filter((summary) => summary.canPrepareFromStart)
            .sort((a, b) => a.dilutionFactor - b.dilutionFactor);

        const steps: SerialInstruction[] = [];
        const tolerance = 1e-9;
        if (eligible.length === 0) return steps;

        const requiredTotals = new Array<number>(eligible.length).fill(0);
        for (let i = eligible.length - 1; i >= 0; i -= 1) {
            const current = eligible[i];
            let required = current.preparedVolume;
            if (i < eligible.length - 1) {
                const next = eligible[i + 1];
                const nextStepFactor = next.dilutionFactor / Math.max(current.dilutionFactor, 1e-12);
                const transferToNext = requiredTotals[i + 1] / Math.max(nextStepFactor, 1e-12);
                required += transferToNext;
            }
            requiredTotals[i] = required;
        }

        for (let i = 0; i < eligible.length; i += 1) {
            const current = eligible[i];
            const previous = i > 0 ? eligible[i - 1] : null;
            const sourceLabel = previous ? previous.label : "start solution";
            const rawStepFactor = previous
                ? current.dilutionFactor / Math.max(previous.dilutionFactor, 1e-12)
                : current.dilutionFactor;
            const stepFactor = Math.max(rawStepFactor, 1);
            const requiredTotalVolume = requiredTotals[i];
            const transferVolume =
                stepFactor <= 1 + tolerance
                    ? requiredTotalVolume
                    : requiredTotalVolume / stepFactor;
            const diluentVolume = Math.max(requiredTotalVolume - transferVolume, 0);
            const transferToNext =
                i < eligible.length - 1
                    ? requiredTotals[i + 1] / Math.max(eligible[i + 1].dilutionFactor / Math.max(current.dilutionFactor, 1e-12), 1e-12)
                    : 0;

            steps.push({
                key: current.key,
                sourceLabel,
                stepFactor,
                transferVolume,
                diluentVolume,
                fromStart: !previous,
                dispenseVolume: current.preparedVolume,
                requiredTotalVolume,
                transferToNext,
            });
        }

        return steps;
    }, [analysis.summaries]);

    const serialInstructionByKey = useMemo(
        () => new Map(serialInstructions.map((step) => [step.key, step])),
        [serialInstructions]
    );

    const handleConcentrationUnitChange = (
        field: "stock" | "start",
        nextUnit: string,
        source: "select" | "parsed"
    ) => {
        const currentUnit = field === "stock" ? stockUnit : startUnit;
        const currentValue = field === "stock" ? stockValue : startValue;

        if (source === "parsed") {
            if (field === "stock") {
                setStockUnit(nextUnit);
            } else {
                setStartUnit(nextUnit);
            }
            return;
        }

        const parsed = Number.parseFloat(currentValue);
        if (!Number.isFinite(parsed) || currentUnit === nextUnit) {
            if (field === "stock") {
                setStockUnit(nextUnit);
            } else {
                setStartUnit(nextUnit);
            }
            return;
        }

        const converted = convertUnitValue(parsed, currentUnit, nextUnit);
        if (converted === null) {
            if (field === "stock") {
                setStockUnit(nextUnit);
            } else {
                setStartUnit(nextUnit);
            }
            return;
        }

        const normalized = formatNumber(converted, 8);
        if (field === "stock") {
            setStockValue(normalized);
            setStockUnit(nextUnit);
        } else {
            setStartValue(normalized);
            setStartUnit(nextUnit);
        }
    };

    const handleVolumeUnitChange = (nextUnit: string, source: "select" | "parsed") => {
        if (source === "parsed") {
            setPerWellVolumeUnit(nextUnit);
            return;
        }

        const parsed = Number.parseFloat(perWellVolume);
        if (!Number.isFinite(parsed) || perWellVolumeUnit === nextUnit) {
            setPerWellVolumeUnit(nextUnit);
            return;
        }
        const converted = convertUnitValue(parsed, perWellVolumeUnit, nextUnit);
        if (converted === null) {
            setPerWellVolumeUnit(nextUnit);
            return;
        }
        setPerWellVolume(formatNumber(converted, 8));
        setPerWellVolumeUnit(nextUnit);
    };

    const handleWellBlur = (wellId: string) => {
        const raw = (wellValues[wellId] ?? "").trim();
        if (!raw) {
            setWellValues((prev) => ({ ...prev, [wellId]: "" }));
            return;
        }

        if (isBlankAlias(raw) || isCanonicalBlank(raw)) {
            setWellValues((prev) => ({ ...prev, [wellId]: BLANK_TOKEN }));
            return;
        }

        if (mode === "dilution") {
            const factor = parseDilutionFactor(raw);
            if (factor !== null) {
                setWellValues((prev) => ({ ...prev, [wellId]: ratioLabel(factor) }));
                return;
            }
            setWellValues((prev) => ({ ...prev, [wellId]: raw }));
            return;
        }

        const parsed = parseConcentrationToken(raw, startUnit);
        if (parsed !== null) {
            const normalized = `${formatNumber(parsed.value)} ${getUnitLabel(parsed.unit)}`;
            setWellValues((prev) => ({ ...prev, [wellId]: normalized }));
            return;
        }
        setWellValues((prev) => ({ ...prev, [wellId]: raw }));
    };

    const handleClearPlate = () => {
        const next = { ...wellValues };
        for (const wellId of wellIds) {
            delete next[wellId];
        }
        setWellValues(next);
        setFillFeedback(null);
    };

    const handleFillReplicates = () => {
        setFillFeedback(null);
        const replicateCount = parsePositiveInteger(replicates) ?? 1;
        if (replicateCount <= 1) {
            push("Set replicates to 2 or more to use Fill Replicates.", "info");
            return;
        }
        if (filledWellIds.length === 0) {
            push("Add at least one well value before filling replicates.", "info");
            return;
        }

        const sourceIndices = filledWellIds
            .map((wellId) => wellIds.indexOf(wellId))
            .filter((idx) => idx >= 0);
        const sourceCoords = sourceIndices.map((idx) => getCoord(idx, plate.cols));
        const bounds = getSourceBoundingBox(sourceCoords);
        const blockHeight = bounds.maxRow - bounds.minRow + 1;
        const blockWidth = bounds.maxCol - bounds.minCol + 1;

        let deltaRow = 0;
        let deltaCol = 0;
        if (fillMode === "column") {
            deltaCol = fillDirection === "left" ? -blockWidth : blockWidth;
        } else {
            deltaRow = fillDirection === "up" ? -blockHeight : blockHeight;
        }

        const sourceByIndex = new Map<number, string>();
        for (const idx of sourceIndices) {
            const id = wellIds[idx];
            const raw = (wellValues[id] ?? "").trim();
            if (raw !== "") {
                sourceByIndex.set(idx, raw);
            }
        }

        const plannedWrites: Array<{ targetIndex: number; value: string }> = [];
        let overflow = false;
        for (let copy = 1; copy < replicateCount; copy += 1) {
            for (const [sourceIndex, value] of sourceByIndex.entries()) {
                const coord = getCoord(sourceIndex, plate.cols);
                const target: Coord = {
                    row: coord.row + deltaRow * copy,
                    col: coord.col + deltaCol * copy,
                };
                if (target.row < 0 || target.row >= plate.rows || target.col < 0 || target.col >= plate.cols) {
                    overflow = true;
                    continue;
                }
                plannedWrites.push({
                    targetIndex: toIndex(target, plate.cols),
                    value,
                });
            }
        }

        if (overflow) {
            const suggestion =
                fillMode === "column"
                    ? "Replicate fill overflows the plate in column-wise mode. Try row-wise fill."
                    : "Replicate fill overflows the plate in row-wise mode. Try column-wise fill.";
            setFillFeedback(suggestion);
            push("Replicate fill overflow detected.", "error");
            return;
        }

        const conflicts = plannedWrites.filter(({ targetIndex, value }) => {
            const targetWell = wellIds[targetIndex];
            const existing = (wellValues[targetWell] ?? "").trim();
            return existing !== "" && existing !== value;
        });

        const shouldOverwrite =
            conflicts.length > 0
                ? window.confirm(
                    `${conflicts.length} destination wells already have values.\n\nOK = overwrite existing values\nCancel = skip filled wells`
                )
                : true;

        const nextValues = { ...wellValues };
        let applied = 0;
        let skipped = 0;
        for (const write of plannedWrites) {
            const targetWell = wellIds[write.targetIndex];
            const existing = (nextValues[targetWell] ?? "").trim();
            if (existing !== "" && existing !== write.value && !shouldOverwrite) {
                skipped += 1;
                continue;
            }
            nextValues[targetWell] = write.value;
            applied += 1;
        }

        setWellValues(nextValues);
        setFillFeedback(null);
        push(
            skipped > 0
                ? `Replicates filled: ${applied} wells updated, ${skipped} skipped.`
                : `Replicates filled: ${applied} wells updated.`,
            "success"
        );
    };

    const safeReplicates = parsePositiveInteger(replicates) ?? 1;
    const canFillReplicates = safeReplicates > 1 && filledWellIds.length > 0;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                    Plate Planner
                </h2>
                <p className="text-xs text-zinc-500">
                    Edit any well directly, switch between dilution/concentration input, then auto-fill replicate blocks.
                </p>
            </div>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                        {PLATE_PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                onClick={() => setPlateKey(preset.key)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    plateKey === preset.key ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                {preset.key}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                        <button
                            onClick={() => setMode("dilution")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                mode === "dilution" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Dilution
                        </button>
                        <button
                            onClick={() => setMode("concentration")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                mode === "concentration" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Concentration
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                    <ValueUnitInput
                        label="Stock Concentration"
                        value={stockValue}
                        unit={stockUnit}
                        onValueChange={setStockValue}
                        onUnitChange={(unit, source) => handleConcentrationUnitChange("stock", unit, source)}
                        options={CONCENTRATION_UNITS}
                        placeholder="1"
                    />
                    <ValueUnitInput
                        label="Start Concentration"
                        value={startValue}
                        unit={startUnit}
                        onValueChange={setStartValue}
                        onUnitChange={(unit, source) => handleConcentrationUnitChange("start", unit, source)}
                        options={CONCENTRATION_UNITS}
                        placeholder="0.5"
                    />
                    <ValueUnitInput
                        label="Per-Well Volume"
                        value={perWellVolume}
                        unit={perWellVolumeUnit}
                        onValueChange={setPerWellVolume}
                        onUnitChange={handleVolumeUnitChange}
                        options={VOLUME_UNITS}
                        placeholder="100"
                    />
                </div>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Replicates</label>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={replicates}
                            onChange={(e) => setReplicates(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Extra Samples</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={extraSamples}
                            onChange={(e) => setExtraSamples(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Overage</label>
                        <select
                            value={overagePercent}
                            onChange={(e) => setOveragePercent(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                        >
                            <option value="0" className="bg-zinc-900">0%</option>
                            <option value="10" className="bg-zinc-900">10%</option>
                            <option value="15" className="bg-zinc-900">15%</option>
                            <option value="20" className="bg-zinc-900">20%</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Replicate Fill Mode</label>
                        <select
                            value={fillMode}
                            onChange={(e) => {
                                const next = e.target.value as FillMode;
                                setFillMode(next);
                                setFillDirection(next === "column" ? "right" : "down");
                            }}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40"
                        >
                            <option value="column" className="bg-zinc-900">Column-wise</option>
                            <option value="row" className="bg-zinc-900">Row-wise</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Direction</label>
                        <select
                            value={fillDirection}
                            onChange={(e) => setFillDirection(e.target.value as FillDirection)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40"
                        >
                            {fillMode === "column" ? (
                                <>
                                    <option value="right" className="bg-zinc-900">Right</option>
                                    <option value="left" className="bg-zinc-900">Left</option>
                                </>
                            ) : (
                                <>
                                    <option value="down" className="bg-zinc-900">Down</option>
                                    <option value="up" className="bg-zinc-900">Up</option>
                                </>
                            )}
                        </select>
                    </div>

                    {canFillReplicates && (
                        <button
                            onClick={handleFillReplicates}
                            className="secondary px-3 py-2 text-xs flex items-center gap-2"
                        >
                            <WandSparkles className="h-3.5 w-3.5" />
                            Fill Replicates
                        </button>
                    )}

                    <button
                        onClick={handleClearPlate}
                        className="secondary px-3 py-2 text-xs"
                    >
                        Clear Plate
                    </button>
                </div>

                {sourcePatternHint && (
                    <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>{sourcePatternHint}</p>
                    </div>
                )}

                {fillFeedback && (
                    <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>{fillFeedback}</p>
                    </div>
                )}
            </section>

            {(analysis.errors.length > 0 || analysis.warnings.length > 0) && (
                <section className="glass-card p-4 sm:p-5 space-y-3">
                    {analysis.errors.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                {analysis.errors.map((error) => (
                                    <p key={error}>{error}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    {analysis.warnings.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 p-3 rounded-lg">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                {analysis.warnings.map((warning) => (
                                    <p key={warning}>{warning}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-200 flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-indigo-400" />
                        {plate.label} Layout
                    </h3>
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                        {filledWellIds.length}/{wellIds.length} well(s) filled
                    </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 p-3">
                    <div
                        className="grid gap-1.5 min-w-max"
                        style={{ gridTemplateColumns: `repeat(${plate.cols}, minmax(72px, 1fr))` }}
                    >
                        {wellIds.map((wellId) => (
                            <div key={wellId} className="rounded-lg border border-white/10 bg-white/[0.02] p-1.5 space-y-1">
                                <div className="text-[10px] text-zinc-500 font-mono">{wellId}</div>
                                {(() => {
                                    const rawValue = wellValues[wellId] ?? "";
                                    const blankDisplay = isCanonicalBlank(rawValue);
                                    const inputWidthCh = getWellInputWidthCh(rawValue);
                                    return (
                                <input
                                    value={rawValue}
                                    onChange={(e) =>
                                        setWellValues((prev) => ({ ...prev, [wellId]: e.target.value }))
                                    }
                                    onBlur={() => handleWellBlur(wellId)}
                                    placeholder={mode === "dilution" ? "1:2" : `10 ${getUnitLabel(startUnit)}`}
                                    className={`max-w-full bg-transparent border border-white/10 rounded px-1.5 py-1 text-[11px] outline-none focus:border-indigo-500/40 font-mono placeholder:text-zinc-700 placeholder:opacity-25 ${
                                        blankDisplay ? "text-zinc-300 tracking-wide [font-variant:small-caps]" : "text-white"
                                    }`}
                                    style={{ width: `${inputWidthCh}ch` }}
                                />
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-[11px] text-zinc-500">
                    {mode === "dilution"
                        ? "Dilution wells accept 1:2, x2, or 2. Values <= 1 are flagged."
                        : 'Concentration wells accept values with units (for example 1M, 20 uM, 10 mM, 1 mg/mL). Bare numbers default to start unit. "0", "b", or "blank" are treated as BLANK.'}
                </p>
            </section>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-zinc-200">Condition Summary</h3>

                {analysis.summaries.length === 0 ? (
                    <div className="text-sm text-zinc-500 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                        Enter values in plate wells to generate condition totals.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="text-left px-3 py-2">Condition</th>
                                    <th className="text-left px-3 py-2">Wells</th>
                                    <th className="text-left px-3 py-2">Dilution Factor</th>
                                    <th className="text-left px-3 py-2">Final Concentration</th>
                                    <th className="text-left px-3 py-2">Dispensed</th>
                                    <th className="text-left px-3 py-2">Prepare (+extra/overage)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.summaries.map((summary) => (
                                    <tr key={summary.key} className="border-t border-white/5 text-zinc-300">
                                        <td className="px-3 py-2 font-mono">{summary.label}</td>
                                        <td className="px-3 py-2 font-mono">{summary.wells}</td>
                                        <td className="px-3 py-2 font-mono text-indigo-300">{ratioLabel(summary.dilutionFactor)}</td>
                                        <td className="px-3 py-2 font-mono">{summary.finalDisplay}</td>
                                        <td className="px-3 py-2 font-mono">{formatVolumeWithAutoMicro(summary.dispensedVolume, perWellVolumeUnit)}</td>
                                        <td className="px-3 py-2 font-mono">{formatVolumeWithAutoMicro(summary.preparedVolume, perWellVolumeUnit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-200">Preparation Instructions</h3>
                    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                        <button
                            onClick={() => setPreparationMethod("direct")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                preparationMethod === "direct"
                                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Direct
                        </button>
                        <button
                            onClick={() => setPreparationMethod("serial")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                preparationMethod === "serial"
                                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Serial
                        </button>
                    </div>
                </div>

                {analysis.summaries.length === 0 && analysis.blankWells === 0 ? (
                    <div className="text-sm text-zinc-500 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                        Enter plate values to generate preparation instructions.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {analysis.summaries.map((summary, index) => (
                            <div
                                key={`prep-${summary.key}`}
                                className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-200"
                            >
                                <p className="font-medium">
                                    {index + 1}. {summary.label} ({summary.wells} well{summary.wells === 1 ? "" : "s"})
                                </p>
                                {!summary.canPrepareFromStart ? (
                                    <p className="text-amber-300 text-xs mt-1">
                                        Cannot prepare from start by dilution alone (target is higher than start concentration).
                                    </p>
                                ) : preparationMethod === "direct" ? (
                                    summary.diluentVolume <= 1e-12 ? (
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Use start solution directly: prepare {formatVolumeWithAutoMicro(summary.preparedVolume, perWellVolumeUnit)} (no diluent).
                                        </p>
                                    ) : (
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Mix {formatVolumeWithAutoMicro(summary.transferFromStart, perWellVolumeUnit)} of start solution + {formatVolumeWithAutoMicro(summary.diluentVolume, perWellVolumeUnit)} diluent to make {formatVolumeWithAutoMicro(summary.preparedVolume, perWellVolumeUnit)} total.
                                        </p>
                                    )
                                ) : (() => {
                                    const serial = serialInstructionByKey.get(summary.key);
                                    if (!serial) {
                                        return (
                                            <p className="text-amber-300 text-xs mt-1">
                                                Could not build a serial step for this condition.
                                            </p>
                                        );
                                    }
                                    if (serial.diluentVolume <= 1e-12) {
                                        return (
                                            <p className="text-zinc-400 text-xs mt-1">
                                                Use {serial.sourceLabel} directly: prepare {formatVolumeWithAutoMicro(serial.requiredTotalVolume, perWellVolumeUnit)} total (no diluent).
                                            </p>
                                        );
                                    }
                                    return (
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Mix {formatVolumeWithAutoMicro(serial.transferVolume, perWellVolumeUnit)} of {serial.sourceLabel} + {formatVolumeWithAutoMicro(serial.diluentVolume, perWellVolumeUnit)} diluent to make {formatVolumeWithAutoMicro(serial.requiredTotalVolume, perWellVolumeUnit)} total ({ratioLabel(serial.stepFactor)} serial step{serial.fromStart ? " from start" : ""}).
                                        </p>
                                    );
                                })()}
                                {preparationMethod === "serial" && summary.canPrepareFromStart && (
                                    <p className="text-zinc-500 text-[11px] mt-1">
                                        Use {formatVolumeWithAutoMicro(serialInstructionByKey.get(summary.key)?.dispenseVolume ?? summary.preparedVolume, perWellVolumeUnit)} for this condition{(serialInstructionByKey.get(summary.key)?.transferToNext ?? 0) > 1e-12 ? ` and reserve ${formatVolumeWithAutoMicro(serialInstructionByKey.get(summary.key)?.transferToNext ?? 0, perWellVolumeUnit)} to prepare the next serial dilution.` : "."}
                                    </p>
                                )}
                                <p className="text-zinc-500 text-[11px] mt-1">
                                    Dispense {formatVolumeWithAutoMicro(parsePositiveNumber(perWellVolume) ?? 0, perWellVolumeUnit)} per well.
                                </p>
                            </div>
                        ))}

                        {analysis.blankWells > 0 && (
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-200">
                                <p className="font-medium">
                                    BLANK ({analysis.blankWells} well{analysis.blankWells === 1 ? "" : "s"})
                                </p>
                                <p className="text-zinc-400 text-xs mt-1">
                                    Prepare {formatVolumeWithAutoMicro(analysis.blankPreparedVolume, perWellVolumeUnit)} diluent only, then dispense {formatVolumeWithAutoMicro(parsePositiveNumber(perWellVolume) ?? 0, perWellVolumeUnit)} per blank well.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
