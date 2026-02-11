"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, LayoutGrid, Minus, Plus } from "lucide-react";
import { parseDilutionFactor } from "@/lib/chemistry/dilution";
import { convertUnitValue, getUnitLabel, parseValueWithUnit } from "@/lib/chemistry/units";
import {
    buildDilutionConcentrationMap,
    buildOrderedDilutionFactors,
    buildPerceptualShadeStyles,
    buildSequentialDilutionSteps,
    detectLaneReplicateSuggestions,
    findMonotonicIncreaseViolations,
    type LaneReplicateSuggestion,
    type FillMode,
    type OrderedDilutionFactor,
    type WellShadeStyle,
} from "@/lib/platePlanner/logic";
import { ValueUnitInput } from "@/components/ui/ValueUnitInput";
import { useToastStore } from "@/store/useToastStore";

type PlannerMode = "dilution" | "concentration";
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

interface SequentialDilutionInstruction {
    key: string;
    wellId: string;
    label: string;
    sourceLabel: string;
    stepFactor: number;
    cumulativeFactor: number;
    finalDisplay: string;
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

interface QuickReplicateAction {
    axis: FillMode;
    targetLanes: number[];
    blockTargets: Array<{
        blockId: number;
        sourceLane: number;
        targetLane: number;
    }>;
    writes: Array<{
        wellId: string;
        previousRaw: string;
        nextRaw: string;
    }>;
}

interface ReplicateBlock {
    id: number;
    axis: FillMode;
    lanes: number[];
}

interface LaneBlockMeta {
    blockId: number;
    blockOrdinal: number;
    laneOrdinal: number;
    colorHex: string;
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
const SHADE_BIN_COLORS_LOW_TO_HIGH = ["#183746", "#1f4f60", "#2a6878", "#36858f", "#4ca9a5", "#75c7b8"];
const SHADE_BACKGROUND_ALPHA = 0.34;
const SHADE_BORDER_ALPHA = 0.7;
const REPLICATE_BLOCK_COLORS = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#22d3ee"];
const BLANK_SHADE_STYLE: WellShadeStyle = {
    backgroundColor: "rgba(15, 23, 42, 0.22)",
    borderColor: "rgba(100, 116, 139, 0.26)",
};

function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace("#", "");
    if (!/^[\da-fA-F]{6}$/.test(normalized)) {
        return `rgba(0, 0, 0, ${alpha})`;
    }
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parsePositiveNumber(raw: string): number | null {
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
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

function getReplicateCountForAxis(blocks: ReplicateBlock[], axis: FillMode): number {
    const axisBlocks = blocks.filter((block) => block.axis === axis);
    if (axisBlocks.length === 0) return 1;
    return Math.max(...axisBlocks.map((block) => block.lanes.length));
}

function applyOverageToTotal(baseVolume: number, overagePercent: number): number {
    if (!Number.isFinite(baseVolume) || baseVolume <= 0) return 0;
    if (!Number.isFinite(overagePercent) || overagePercent <= 0) return baseVolume;
    return baseVolume + (baseVolume * overagePercent) / 100;
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

    const [replicates, setReplicates] = useState("1");
    const [overagePercent, setOveragePercent] = useState("10");

    const [perWellVolume, setPerWellVolume] = useState("100");
    const [perWellVolumeUnit, setPerWellVolumeUnit] = useState("μL");

    const [wellValues, setWellValues] = useState<Record<string, string>>({});
    const [preparationMethod, setPreparationMethod] = useState<PreparationMethod>("direct");
    const [hoveredReplicateLane, setHoveredReplicateLane] = useState<number | null>(null);
    const [replicateBlocks, setReplicateBlocks] = useState<ReplicateBlock[]>([]);
    const [quickReplicateHistory, setQuickReplicateHistory] = useState<QuickReplicateAction[]>([]);
    const replicateBlockIdRef = useRef(1);

    const plate = PLATE_PRESETS.find((entry) => entry.key === plateKey) ?? PLATE_PRESETS[4];
    const wellIds = useMemo(() => buildWellIds(plate.rows, plate.cols), [plate.rows, plate.cols]);

    const filledWellIds = useMemo(
        () => wellIds.filter((wellId) => (wellValues[wellId] ?? "").trim() !== ""),
        [wellIds, wellValues]
    );

    const analysis = useMemo<PlateAnalysis>(() => {
        const errors: string[] = [];
        const warnings: string[] = [];

        const startConcentration = parsePositiveNumber(startValue);
        const stockConcentration = parsePositiveNumber(stockValue);
        const replicateCount = parsePositiveInteger(replicates);
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
        const safeOverage = Number.isFinite(overage) && overage >= 0 ? overage : 0;
        const safePerWell = perWell ?? 0;

        const computePreparedVolume = (wellCount: number): number => {
            if (wellCount <= 0) return 0;
            const baseTotalVolume = safePerWell * wellCount;
            return applyOverageToTotal(baseTotalVolume, safeOverage);
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

        const monotonicCheckEntries = entries
            .map((entry) => {
                const concentration = mode === "dilution"
                    ? entry.finalValue
                    : convertUnitValue(entry.finalValue, entry.finalUnit, startUnit) ?? entry.finalValue;
                return {
                    wellId: entry.wellId,
                    concentration,
                };
            })
            .filter((entry) => Number.isFinite(entry.concentration));

        const monotonicViolations = findMonotonicIncreaseViolations({
            entries: monotonicCheckEntries,
            wellIds,
            wellValues,
            cols: plate.cols,
            fillMode,
            isBlank: (raw) => isBlankAlias(raw) || isCanonicalBlank(raw),
        });
        for (const violation of monotonicViolations) {
            warnings.push(
                `${violation.currentWellId}: concentration increases compared with ${violation.previousWellId} within a detected ${fillMode}-wise series (${formatNumber(violation.currentConcentration)} > ${formatNumber(violation.previousConcentration)} ${getUnitLabel(startUnit)}).`
            );
        }

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
        fillMode,
        filledWellIds,
        mode,
        overagePercent,
        plate,
        perWellVolume,
        replicates,
        startUnit,
        startValue,
        stockUnit,
        stockValue,
        wellIds,
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

    const orderedDilutionFactors = useMemo<{ ordered: OrderedDilutionFactor[]; blankOrderingApplied: boolean }>(() => {
        if (mode !== "dilution") {
            return { ordered: [], blankOrderingApplied: false };
        }

        return buildOrderedDilutionFactors({
            wellIds,
            wellValues,
            cols: plate.cols,
            isBlank: (raw) => isBlankAlias(raw) || isCanonicalBlank(raw),
            parseDilutionFactor,
        });
    }, [mode, plate.cols, wellIds, wellValues]);

    const sequentialDilutionInstructions = useMemo<SequentialDilutionInstruction[]>(() => {
        if (mode !== "dilution") return [];

        const startConcentration = parsePositiveNumber(startValue);
        const perWell = parsePositiveNumber(perWellVolume);
        const parsedOverage = Number.parseFloat(overagePercent);
        const safeOverage = Number.isFinite(parsedOverage) && parsedOverage >= 0 ? parsedOverage : 0;

        if (!startConcentration || !perWell) {
            return [];
        }

        const orderedFactors = orderedDilutionFactors.ordered;

        if (orderedFactors.length === 0) return [];

        const steps = buildSequentialDilutionSteps({
            orderedFactors,
            startConcentration,
            perWellVolume: perWell,
            extraCount: 0,
            overagePercent: safeOverage,
        });

        return steps.map((step, index) => {
            const sourceLabel = step.sourceWellId && step.sourceStepFactor
                ? `${step.sourceWellId} (${ratioLabel(step.sourceStepFactor)})`
                : "start solution";
            return {
                key: `${step.wellId}-${index}`,
                wellId: step.wellId,
                label: ratioLabel(step.stepFactor),
                sourceLabel,
                stepFactor: step.stepFactor,
                cumulativeFactor: step.cumulativeFactor,
                finalDisplay: `${formatNumber(step.finalConcentration)} ${getUnitLabel(startUnit)}`,
                transferVolume: step.transferVolume,
                diluentVolume: step.diluentVolume,
                fromStart: step.fromStart,
                dispenseVolume: step.dispenseVolume,
                requiredTotalVolume: step.requiredTotalVolume,
                transferToNext: step.transferToNext,
            };
        });
    }, [mode, orderedDilutionFactors.ordered, overagePercent, perWellVolume, startUnit, startValue]);

    const wellShadeStyleById = useMemo(() => {
        const isBlank = (raw: string) => isBlankAlias(raw) || isCanonicalBlank(raw);

        let concentrationByWell = new Map<string, number>();
        let blankWellIds = new Set<string>();

        if (mode === "dilution") {
            const startConcentration = parsePositiveNumber(startValue) ?? 0;
            const dilutionMap = buildDilutionConcentrationMap({
                wellIds,
                wellValues,
                cols: plate.cols,
                fillMode,
                startConcentration,
                isBlank,
                parseDilutionFactor,
            });
            concentrationByWell = dilutionMap.concentrationByWell;
            blankWellIds = dilutionMap.blankWellIds;
        } else {
            for (const wellId of wellIds) {
                const raw = (wellValues[wellId] ?? "").trim();
                if (raw !== "" && isBlank(raw)) {
                    blankWellIds.add(wellId);
                }
            }

            const startConcentration = parsePositiveNumber(startValue);
            if (startConcentration) {
                for (const entry of analysis.entries) {
                    if (entry.dilutionFactor > 0) {
                        concentrationByWell.set(
                            entry.wellId,
                            startConcentration / Math.max(entry.dilutionFactor, 1e-12)
                        );
                    }
                }
            }
        }

        return buildPerceptualShadeStyles({
            concentrationByWell,
            blankWellIds,
            paletteHexLowToHigh: SHADE_BIN_COLORS_LOW_TO_HIGH,
            backgroundAlpha: SHADE_BACKGROUND_ALPHA,
            borderAlpha: SHADE_BORDER_ALPHA,
            blankStyle: BLANK_SHADE_STYLE,
        });
    }, [analysis.entries, fillMode, mode, plate.cols, startValue, wellIds, wellValues]);

    const laneReplicateSuggestions = useMemo<LaneReplicateSuggestion[]>(() => {
        const startConcentration = parsePositiveNumber(startValue) ?? 0;
        return detectLaneReplicateSuggestions({
            wellIds,
            wellValues,
            rows: plate.rows,
            cols: plate.cols,
            fillMode,
            mode,
            startConcentration,
            isBlank: (raw) => isBlankAlias(raw) || isCanonicalBlank(raw),
            parseDilutionFactor,
            parseConcentration: (raw) => {
                const parsed = parseConcentrationToken(raw, startUnit);
                if (!parsed) return null;
                const inStartUnit = convertUnitValue(parsed.value, parsed.unit, startUnit);
                return inStartUnit ?? null;
            },
            minSeriesLength: 3,
        });
    }, [fillMode, mode, plate.cols, plate.rows, startUnit, startValue, wellIds, wellValues]);

    const laneReplicateSuggestionByTarget = useMemo(
        () => {
            const map = new Map<number, LaneReplicateSuggestion>();
            for (const suggestion of laneReplicateSuggestions) {
                for (const targetLane of suggestion.targetLanes) {
                    map.set(targetLane, suggestion);
                }
            }
            return map;
        },
        [laneReplicateSuggestions]
    );
    const laneBlockMetaByIndex = useMemo(() => {
        const axisBlocks = replicateBlocks
            .filter((block) => block.axis === fillMode)
            .slice()
            .sort((a, b) => a.id - b.id);
        const map = new Map<number, LaneBlockMeta>();
        axisBlocks.forEach((block, blockIndex) => {
            const colorHex = REPLICATE_BLOCK_COLORS[blockIndex % REPLICATE_BLOCK_COLORS.length];
            const lanes = block.lanes.slice().sort((a, b) => a - b);
            lanes.forEach((lane, laneIndex) => {
                map.set(lane, {
                    blockId: block.id,
                    blockOrdinal: blockIndex + 1,
                    laneOrdinal: laneIndex + 1,
                    colorHex,
                });
            });
        });
        return map;
    }, [fillMode, replicateBlocks]);
    const hasCurrentAxisReplicateBlocks = laneBlockMetaByIndex.size > 0;
    const lastQuickReplicateAction = quickReplicateHistory[quickReplicateHistory.length - 1] ?? null;

    const useSequentialPreparationInstructions =
        mode === "dilution" && sequentialDilutionInstructions.length > 0;
    const useSequentialConditionSummary =
        mode === "dilution" && sequentialDilutionInstructions.length > 0;

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

    const writeWellRaw = (next: Record<string, string>, wellId: string, raw: string) => {
        if (raw.trim() === "") {
            delete next[wellId];
            return;
        }
        next[wellId] = raw;
    };

    const applyValueWithReplicatePropagation = (
        base: Record<string, string>,
        wellId: string,
        raw: string
    ): Record<string, string> => {
        const next = { ...base };
        writeWellRaw(next, wellId, raw);

        if (replicateBlocks.length === 0) {
            return next;
        }

        const sourceIndex = wellIds.indexOf(wellId);
        if (sourceIndex < 0) {
            return next;
        }

        const sourceCoord = getCoord(sourceIndex, plate.cols);

        for (const block of replicateBlocks) {
            const sourceLane = block.axis === "column" ? sourceCoord.col : sourceCoord.row;
            if (!block.lanes.includes(sourceLane)) {
                continue;
            }

            const seriesIndex = block.axis === "column" ? sourceCoord.row : sourceCoord.col;
            for (const lane of block.lanes) {
                const targetCoord =
                    block.axis === "column"
                        ? { row: seriesIndex, col: lane }
                        : { row: lane, col: seriesIndex };
                const targetWellId = wellIds[toIndex(targetCoord, plate.cols)];
                if (!targetWellId) continue;
                writeWellRaw(next, targetWellId, raw);
            }
        }

        return next;
    };

    const assignReplicateBlock = (blocksInput: ReplicateBlock[], axis: FillMode, sourceLane: number, targetLane: number) => {
        const relatedBlocks = blocksInput.filter(
            (block) =>
                block.axis === axis &&
                (block.lanes.includes(sourceLane) || block.lanes.includes(targetLane))
        );

        if (relatedBlocks.length === 0) {
            const blockId = replicateBlockIdRef.current;
            replicateBlockIdRef.current += 1;
            const newBlock: ReplicateBlock = {
                id: blockId,
                axis,
                lanes: Array.from(new Set([sourceLane, targetLane])).sort((a, b) => a - b),
            };
            return { blockId, blocks: [...blocksInput, newBlock] };
        }

        const primaryBlock = relatedBlocks[0];
        const mergedLanes = Array.from(
            new Set([
                sourceLane,
                targetLane,
                ...relatedBlocks.flatMap((block) => block.lanes),
            ])
        ).sort((a, b) => a - b);
        const mergedIds = new Set(relatedBlocks.map((block) => block.id));
        const blocks = blocksInput
            .filter((block) => !mergedIds.has(block.id))
            .concat([{ id: primaryBlock.id, axis, lanes: mergedLanes }]);

        return { blockId: primaryBlock.id, blocks };
    };

    const getWellIdAtAxis = (axis: FillMode, lane: number, seriesIndex: number): string | null => {
        const coord =
            axis === "column"
                ? { row: seriesIndex, col: lane }
                : { row: lane, col: seriesIndex };
        const idx = toIndex(coord, plate.cols);
        return wellIds[idx] ?? null;
    };

    const getTraversalWellIds = (axis: FillMode): string[] => {
        if (axis === "column") {
            const laneIndices = fillDirection === "left"
                ? Array.from({ length: plate.cols }, (_, idx) => plate.cols - 1 - idx)
                : Array.from({ length: plate.cols }, (_, idx) => idx);
            return laneIndices.flatMap((lane) =>
                Array.from({ length: plate.rows }, (_, seriesIndex) =>
                    getWellIdAtAxis(axis, lane, seriesIndex)
                ).filter((wellId): wellId is string => Boolean(wellId))
            );
        }

        const laneIndices = fillDirection === "up"
            ? Array.from({ length: plate.rows }, (_, idx) => plate.rows - 1 - idx)
            : Array.from({ length: plate.rows }, (_, idx) => idx);
        return laneIndices.flatMap((lane) =>
            Array.from({ length: plate.cols }, (_, seriesIndex) =>
                getWellIdAtAxis(axis, lane, seriesIndex)
            ).filter((wellId): wellId is string => Boolean(wellId))
        );
    };

    const tryExpandReplicateBlocksTo = (targetCount: number): number => {
        if (targetCount <= 1) {
            return getReplicateCountForAxis(replicateBlocks, fillMode);
        }

        const axisBlocks = replicateBlocks
            .filter((block) => block.axis === fillMode)
            .sort((a, b) => a.id - b.id);
        if (axisBlocks.length === 0) {
            push("Create the first duplicate with + before increasing replicates.", "info");
            return getReplicateCountForAxis(replicateBlocks, fillMode);
        }

        const laneLimit = fillMode === "column" ? plate.cols : plate.rows;
        const seriesLength = fillMode === "column" ? plate.rows : plate.cols;
        const preferNegativeDirection =
            (fillMode === "column" && fillDirection === "left") ||
            (fillMode === "row" && fillDirection === "up");

        const nextValues = { ...wellValues };
        const nextBlocks = replicateBlocks.map((block) => ({ ...block, lanes: [...block.lanes] }));
        const nextHistory = [...quickReplicateHistory];
        let totalAdded = 0;
        let blockedAdds = 0;

        for (const axisBlock of axisBlocks) {
            const block = nextBlocks.find((candidate) => candidate.id === axisBlock.id);
            if (!block) continue;

            while (block.lanes.length < targetCount) {
                const sortedLanes = block.lanes.slice().sort((a, b) => a - b);
                const minLane = sortedLanes[0];
                const maxLane = sortedLanes[sortedLanes.length - 1];
                const preferredCandidates = preferNegativeDirection
                    ? Array.from({ length: minLane }, (_, idx) => minLane - 1 - idx)
                    : Array.from({ length: laneLimit - maxLane - 1 }, (_, idx) => maxLane + 1 + idx);
                const fallbackCandidates = preferNegativeDirection
                    ? Array.from({ length: laneLimit - maxLane - 1 }, (_, idx) => maxLane + 1 + idx)
                    : Array.from({ length: minLane }, (_, idx) => minLane - 1 - idx);
                const laneCandidates = [...preferredCandidates, ...fallbackCandidates];

                const reservedLanes = new Set(
                    nextBlocks
                        .filter((candidate) => candidate.axis === fillMode && candidate.id !== block.id)
                        .flatMap((candidate) => candidate.lanes)
                );
                const templateLane = sortedLanes[0];
                let expanded = false;

                for (const targetLane of laneCandidates) {
                    if (targetLane < 0 || targetLane >= laneLimit) continue;
                    if (block.lanes.includes(targetLane) || reservedLanes.has(targetLane)) {
                        continue;
                    }

                    const writes: QuickReplicateAction["writes"] = [];
                    let hasConflict = false;
                    for (let seriesIndex = 0; seriesIndex < seriesLength; seriesIndex += 1) {
                        const sourceWellId = getWellIdAtAxis(fillMode, templateLane, seriesIndex);
                        const targetWellId = getWellIdAtAxis(fillMode, targetLane, seriesIndex);
                        if (!sourceWellId || !targetWellId) continue;

                        const sourceRaw = (nextValues[sourceWellId] ?? "").trim();
                        if (sourceRaw === "") continue;

                        const existing = (nextValues[targetWellId] ?? "").trim();
                        if (existing !== "" && existing !== sourceRaw) {
                            hasConflict = true;
                            break;
                        }

                        writes.push({
                            wellId: targetWellId,
                            previousRaw: existing,
                            nextRaw: sourceRaw,
                        });
                    }

                    if (hasConflict || writes.length === 0) {
                        continue;
                    }

                    for (const write of writes) {
                        nextValues[write.wellId] = write.nextRaw;
                    }
                    block.lanes = Array.from(new Set([...block.lanes, targetLane])).sort((a, b) => a - b);
                    nextHistory.push({
                        axis: fillMode,
                        targetLanes: [targetLane],
                        blockTargets: [{ blockId: block.id, sourceLane: templateLane, targetLane }],
                        writes,
                    });
                    totalAdded += 1;
                    expanded = true;
                    break;
                }

                if (!expanded) {
                    blockedAdds += 1;
                    break;
                }
            }
        }

        if (totalAdded === 0) {
            push("Could not expand replicate blocks to that count with current plate occupancy.", "info");
            return getReplicateCountForAxis(replicateBlocks, fillMode);
        }

        setWellValues(nextValues);
        setReplicateBlocks(nextBlocks);
        setQuickReplicateHistory(nextHistory);
        setHoveredReplicateLane(null);

        if (blockedAdds > 0) {
            push(`Replicates increased where possible. ${blockedAdds} block(s) reached plate/occupancy limits.`, "info");
        } else {
            push(`Replicates increased by ${totalAdded} lane(s).`, "success");
        }

        return getReplicateCountForAxis(nextBlocks, fillMode);
    };

    const handleReplicatesChange = (raw: string) => {
        setReplicates(raw);
        const target = parsePositiveInteger(raw);
        if (!target) {
            return;
        }

        const current = getReplicateCountForAxis(replicateBlocks, fillMode);
        if (target === current) {
            return;
        }
        if (target < current) {
            push("To reduce replicate lanes, use the - button on the most recently duplicated lane.", "info");
            setReplicates(String(current));
            return;
        }

        const synced = tryExpandReplicateBlocksTo(target);
        setReplicates(String(synced));
    };

    const handleWellInputChange = (wellId: string, raw: string) => {
        setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, raw));
    };

    const handleWellBlur = (wellId: string) => {
        const raw = (wellValues[wellId] ?? "").trim();
        if (!raw) {
            setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, ""));
            return;
        }

        if (isBlankAlias(raw) || isCanonicalBlank(raw)) {
            setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, BLANK_TOKEN));
            return;
        }

        if (mode === "dilution") {
            const factor = parseDilutionFactor(raw);
            if (factor !== null) {
                setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, ratioLabel(factor)));
                return;
            }
            setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, raw));
            return;
        }

        const parsed = parseConcentrationToken(raw, startUnit);
        if (parsed !== null) {
            const normalized = `${formatNumber(parsed.value)} ${getUnitLabel(parsed.unit)}`;
            setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, normalized));
            return;
        }
        setWellValues((prev) => applyValueWithReplicatePropagation(prev, wellId, raw));
    };

    const handleClearPlate = () => {
        const next = { ...wellValues };
        for (const wellId of wellIds) {
            delete next[wellId];
        }
        setWellValues(next);
        setReplicateBlocks([]);
        setQuickReplicateHistory([]);
        setReplicates("1");
    };

    const handleQuickReplicateSuggestion = (suggestion: LaneReplicateSuggestion) => {
        if (suggestion.writes.length === 0) {
            push("No series to replicate.", "info");
            return;
        }

        const conflicts = suggestion.writes.filter((write) => {
            const existing = (wellValues[write.targetWellId] ?? "").trim();
            return existing !== "" && existing !== write.raw;
        });

        const shouldOverwrite =
            conflicts.length > 0
                ? window.confirm(
                    `${conflicts.length} destination wells already have values.\n\nOK = overwrite existing values\nCancel = skip filled wells`
                )
                : true;

        const nextValues = { ...wellValues };
        const appliedWrites: QuickReplicateAction["writes"] = [];
        let applied = 0;
        let skipped = 0;
        for (const write of suggestion.writes) {
            const existing = (nextValues[write.targetWellId] ?? "").trim();
            if (existing !== "" && existing !== write.raw && !shouldOverwrite) {
                skipped += 1;
                continue;
            }
            appliedWrites.push({
                wellId: write.targetWellId,
                previousRaw: existing,
                nextRaw: write.raw,
            });
            nextValues[write.targetWellId] = write.raw;
            applied += 1;
        }

        if (applied === 0) {
            push("No wells were replicated.", "info");
            return;
        }

        let nextBlocks = replicateBlocks;
        const blockTargets: QuickReplicateAction["blockTargets"] = [];
        for (const pair of suggestion.lanePairs) {
            const blockAssignment = assignReplicateBlock(
                nextBlocks,
                suggestion.axis,
                pair.sourceLane,
                pair.targetLane
            );
            nextBlocks = blockAssignment.blocks;
            blockTargets.push({
                blockId: blockAssignment.blockId,
                sourceLane: pair.sourceLane,
                targetLane: pair.targetLane,
            });
        }

        setWellValues(nextValues);
        setReplicateBlocks(nextBlocks);
        setReplicates(String(getReplicateCountForAxis(nextBlocks, suggestion.axis)));
        setQuickReplicateHistory((prev) => [
            ...prev,
            {
                axis: suggestion.axis,
                targetLanes: suggestion.targetLanes,
                blockTargets,
                writes: appliedWrites,
            },
        ]);
        setHoveredReplicateLane(null);
        push(
            skipped > 0
                ? `Quick replicate applied: ${applied} wells updated, ${skipped} skipped.`
                : `Quick replicate applied: ${applied} wells updated.`,
            "success"
        );
    };

    const handlePackReplicateSuggestion = (suggestion: LaneReplicateSuggestion) => {
        if (suggestion.sourceSequence.length === 0) {
            push("No series found to pack-replicate.", "info");
            return;
        }

        const traversalWellIds = getTraversalWellIds(suggestion.axis);
        const seriesEndWellId = suggestion.sourceSequence[suggestion.sourceSequence.length - 1]?.sourceWellId;
        const seriesEndPosition = traversalWellIds.indexOf(seriesEndWellId);
        if (seriesEndPosition < 0) {
            push("Could not determine the end of the source series.", "error");
            return;
        }

        const targetWellIds = traversalWellIds.slice(
            seriesEndPosition + 1,
            seriesEndPosition + 1 + suggestion.sourceSequence.length
        );
        if (targetWellIds.length < suggestion.sourceSequence.length) {
            push("Not enough free plate positions after the series end for a packed replicate.", "info");
            return;
        }

        const writes = suggestion.sourceSequence.map((source, index) => ({
            sourceWellId: source.sourceWellId,
            targetWellId: targetWellIds[index],
            raw: source.raw,
        }));

        const conflicts = writes.filter((write) => {
            const existing = (wellValues[write.targetWellId] ?? "").trim();
            return existing !== "" && existing !== write.raw;
        });

        if (
            conflicts.length > 0 &&
            !window.confirm(
                `${conflicts.length} destination wells already have values.\n\nOK = overwrite existing values\nCancel = abort packed replicate`
            )
        ) {
            push("Packed replicate cancelled.", "info");
            return;
        }

        const nextValues = { ...wellValues };
        const appliedWrites: QuickReplicateAction["writes"] = [];
        for (const write of writes) {
            const existing = (nextValues[write.targetWellId] ?? "").trim();
            appliedWrites.push({
                wellId: write.targetWellId,
                previousRaw: existing,
                nextRaw: write.raw,
            });
            nextValues[write.targetWellId] = write.raw;
        }

        const targetLanes = Array.from(
            new Set(
                targetWellIds
                    .map((wellId) => wellIds.indexOf(wellId))
                    .filter((index) => index >= 0)
                    .map((index) => {
                        const coord = getCoord(index, plate.cols);
                        return suggestion.axis === "column" ? coord.col : coord.row;
                    })
            )
        ).sort((a, b) => a - b);

        setWellValues(nextValues);
        setQuickReplicateHistory((prev) => [
            ...prev,
            {
                axis: suggestion.axis,
                targetLanes,
                blockTargets: [],
                writes: appliedWrites,
            },
        ]);
        setHoveredReplicateLane(null);
        push(`Packed replicate applied: ${writes.length} wells updated.`, "success");
    };

    const handleRemoveLastQuickReplicate = () => {
        const lastAction = quickReplicateHistory[quickReplicateHistory.length - 1];
        if (!lastAction) {
            push("No quick replicate lane to remove.", "info");
            return;
        }

        const nextValues = { ...wellValues };
        let reverted = 0;
        let skipped = 0;
        for (const write of lastAction.writes) {
            const existing = (nextValues[write.wellId] ?? "").trim();
            if (existing !== write.nextRaw.trim()) {
                skipped += 1;
                continue;
            }

            if (write.previousRaw === "") {
                delete nextValues[write.wellId];
            } else {
                nextValues[write.wellId] = write.previousRaw;
            }
            reverted += 1;
        }

        let nextBlocks = replicateBlocks.map((block) => ({ ...block, lanes: [...block.lanes] }));
        for (const target of lastAction.blockTargets) {
            nextBlocks = nextBlocks.flatMap((block) => {
                if (block.id !== target.blockId) {
                    return [block];
                }
                const remaining = block.lanes.filter((lane) => lane !== target.targetLane);
                if (remaining.length < 2) {
                    return [];
                }
                return [{ ...block, lanes: remaining }];
            });
        }

        setReplicateBlocks(nextBlocks);
        setReplicates(String(getReplicateCountForAxis(nextBlocks, fillMode)));
        setQuickReplicateHistory((prev) => prev.slice(0, -1));
        setHoveredReplicateLane(null);

        if (reverted === 0) {
            push("Last quick replicate could not be removed because those wells were edited.", "info");
            return;
        }

        setWellValues(nextValues);
        push(
            skipped > 0
                ? `Removed last quick replicate: ${reverted} wells reverted, ${skipped} skipped.`
                : `Removed last quick replicate: ${reverted} wells reverted.`,
            "success"
        );
    };

    const perWellDispense = parsePositiveNumber(perWellVolume) ?? 0;
    const hasConditionSummaryRows = useSequentialConditionSummary
        ? sequentialDilutionInstructions.length > 0
        : analysis.summaries.length > 0;
    const showShadingLegend = wellShadeStyleById.size > 0;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                    Plate Planner
                </h2>
                <p className="text-xs text-zinc-500">
                    Edit wells directly, build duplicate replicate blocks with +, and keep replicate lanes synced.
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

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Replicates</label>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={replicates}
                            onChange={(e) => handleReplicatesChange(e.target.value)}
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
                            <option value="2" className="bg-zinc-900">2%</option>
                            <option value="5" className="bg-zinc-900">5%</option>
                            <option value="10" className="bg-zinc-900">10%</option>
                            <option value="20" className="bg-zinc-900">20%</option>
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Applied to the total prepared volume per condition.
                        </p>
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
                                setReplicates(String(getReplicateCountForAxis(replicateBlocks, next)));
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

                    <button
                        onClick={handleClearPlate}
                        className="secondary px-3 py-2 text-xs"
                    >
                        Clear Plate
                    </button>
                </div>
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
                        onMouseLeave={() => setHoveredReplicateLane(null)}
                    >
                        {wellIds.map((wellId, index) => {
                            const rawValue = wellValues[wellId] ?? "";
                            const blankDisplay = isCanonicalBlank(rawValue);
                            const inputWidthCh = getWellInputWidthCh(rawValue);
                            const cellStyle = wellShadeStyleById.get(wellId);
                            const coord = getCoord(index, plate.cols);
                            const laneIndex = fillMode === "column" ? coord.col : coord.row;
                            const laneSuggestion = laneReplicateSuggestionByTarget.get(laneIndex);
                            const laneBlockMeta = laneBlockMetaByIndex.get(laneIndex);
                            const isLaneAnchor = fillMode === "column" ? coord.row === 0 : coord.col === 0;
                            const isLastReplicatedLane = Boolean(
                                lastQuickReplicateAction &&
                                lastQuickReplicateAction.axis === fillMode &&
                                lastQuickReplicateAction.targetLanes.includes(laneIndex)
                            );
                            const showQuickReplicate = Boolean(
                                laneSuggestion &&
                                hoveredReplicateLane === laneIndex &&
                                isLaneAnchor
                            );
                            const showQuickPack = showQuickReplicate;
                            const showQuickRemove = Boolean(
                                isLastReplicatedLane &&
                                hoveredReplicateLane === laneIndex &&
                                isLaneAnchor
                            );
                            const decoratedCellStyle = laneBlockMeta
                                ? {
                                    ...cellStyle,
                                    boxShadow: `inset 0 0 0 1px ${hexToRgba(laneBlockMeta.colorHex, 0.48)}, inset 0 0 14px ${hexToRgba(laneBlockMeta.colorHex, 0.14)}`,
                                }
                                : cellStyle;

                            return (
                                <div
                                    key={wellId}
                                    className="relative rounded-lg border border-white/10 bg-white/[0.02] p-1.5 space-y-1 transition-colors duration-200"
                                    style={decoratedCellStyle}
                                    onMouseEnter={() => setHoveredReplicateLane(laneIndex)}
                                >
                                    {showQuickRemove && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveLastQuickReplicate();
                                            }}
                                            className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-rose-500 text-white border border-rose-300/70 shadow-md shadow-rose-500/25 flex items-center justify-center hover:bg-rose-400"
                                            title={`Remove the last quick-replicated ${fillMode === "column" ? "column" : "row"}.`}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </button>
                                    )}
                                    {showQuickReplicate && laneSuggestion && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickReplicateSuggestion(laneSuggestion);
                                            }}
                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-emerald-500 text-white border border-emerald-300/70 shadow-md shadow-emerald-500/25 flex items-center justify-center hover:bg-emerald-400"
                                            title={`Replicate detected series into this ${fillMode === "column" ? "column" : "row"}.`}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    )}
                                    {showQuickPack && laneSuggestion && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePackReplicateSuggestion(laneSuggestion);
                                            }}
                                            className="absolute -top-2 left-1/2 -translate-x-1/2 h-5 min-w-5 px-1 rounded-full bg-amber-500 text-white border border-amber-300/70 shadow-md shadow-amber-500/25 flex items-center justify-center hover:bg-amber-400 text-[9px] font-bold"
                                            title={`Pack Replicate: continue this series immediately after its end.`}
                                        >
                                            P
                                        </button>
                                    )}
                                    <div className="text-[10px] text-zinc-500 font-mono">{wellId}</div>
                                    {isLaneAnchor && laneBlockMeta && (
                                        <div
                                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide font-semibold border"
                                            style={{
                                                color: hexToRgba(laneBlockMeta.colorHex, 1),
                                                backgroundColor: hexToRgba(laneBlockMeta.colorHex, 0.14),
                                                borderColor: hexToRgba(laneBlockMeta.colorHex, 0.5),
                                            }}
                                        >
                                            B{laneBlockMeta.blockOrdinal} · R{laneBlockMeta.laneOrdinal}
                                        </div>
                                    )}
                                    <input
                                        value={rawValue}
                                        onChange={(e) => handleWellInputChange(wellId, e.target.value)}
                                        onBlur={() => handleWellBlur(wellId)}
                                        placeholder={mode === "dilution" ? "1:2" : `10 ${getUnitLabel(startUnit)}`}
                                        className={`max-w-full bg-transparent border border-white/10 rounded px-1.5 py-1 text-[11px] outline-none focus:border-indigo-500/40 font-mono placeholder:text-zinc-700 placeholder:opacity-25 ${
                                            blankDisplay ? "text-zinc-300 tracking-wide [font-variant:small-caps]" : "text-white"
                                        }`}
                                        style={{ width: `${inputWidthCh}ch` }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <p className="text-[11px] text-zinc-500">
                    {mode === "dilution"
                        ? "Dilution wells accept 1:2, x2, or 2. Values <= 1 are flagged."
                        : 'Concentration wells accept values with units (for example 1M, 20 uM, 10 mM, 1 mg/mL). Bare numbers default to start unit. "0", "b", or "blank" are treated as BLANK.'}
                </p>
                {laneReplicateSuggestions.length > 0 && (
                    <p className="text-[11px] text-zinc-500">
                        Hover an adjacent empty {fillMode === "column" ? "column" : "row"} to quick-replicate a detected monotonic series. Use P (Pack Replicate) to continue the copy immediately after the current series end.
                    </p>
                )}
                {hasCurrentAxisReplicateBlocks && (
                    <p className="text-[11px] text-zinc-500">
                        Replicate blocks are highlighted and labeled (B# · R#). Editing any lane in a block auto-updates the matching well in sibling replicates.
                    </p>
                )}
                {lastQuickReplicateAction && lastQuickReplicateAction.axis === fillMode && (
                    <p className="text-[11px] text-zinc-500">
                        Hover the most recently quick-replicated {fillMode === "column" ? "column" : "row"} and click - to remove it.
                    </p>
                )}
                {showShadingLegend && (
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider">
                        <span>Low</span>
                        <div className="flex items-center gap-1">
                            {SHADE_BIN_COLORS_LOW_TO_HIGH.map((hex) => (
                                <span
                                    key={`shade-legend-${hex}`}
                                    className="h-3.5 w-3.5 rounded-sm border"
                                    style={{
                                        backgroundColor: hexToRgba(hex, SHADE_BACKGROUND_ALPHA),
                                        borderColor: hexToRgba(hex, SHADE_BORDER_ALPHA),
                                    }}
                                />
                            ))}
                        </div>
                        <span>High</span>
                    </div>
                )}
            </section>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-zinc-200">Condition Summary</h3>
                {mode === "dilution" && orderedDilutionFactors.blankOrderingApplied && (
                    <p className="text-[11px] text-zinc-500">
                        Sequence order is inferred from BLANK wells: dilution runs from wells farthest from BLANK toward BLANK.
                    </p>
                )}

                {hasConditionSummaryRows ? (
                    useSequentialConditionSummary ? (
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full min-w-[860px] text-sm">
                                <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left px-3 py-2">Step</th>
                                        <th className="text-left px-3 py-2">Well</th>
                                        <th className="text-left px-3 py-2">Dilution Step</th>
                                        <th className="text-left px-3 py-2">Cumulative</th>
                                        <th className="text-left px-3 py-2">Final Concentration</th>
                                        <th className="text-left px-3 py-2">Dispensed</th>
                                        <th className="text-left px-3 py-2">Prepare (+extra/overage)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sequentialDilutionInstructions.map((step, index) => (
                                        <tr key={`summary-seq-${step.key}`} className="border-t border-white/5 text-zinc-300">
                                            <td className="px-3 py-2 font-mono">{index + 1}</td>
                                            <td className="px-3 py-2 font-mono">{step.wellId}</td>
                                            <td className="px-3 py-2 font-mono text-indigo-300">{ratioLabel(step.stepFactor)}</td>
                                            <td className="px-3 py-2 font-mono text-cyan-300">{ratioLabel(step.cumulativeFactor)}</td>
                                            <td className="px-3 py-2 font-mono">{step.finalDisplay}</td>
                                            <td className="px-3 py-2 font-mono">{formatVolumeWithAutoMicro(perWellDispense, perWellVolumeUnit)}</td>
                                            <td className="px-3 py-2 font-mono">{formatVolumeWithAutoMicro(step.dispenseVolume, perWellVolumeUnit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                    )
                ) : (
                    <div className="text-sm text-zinc-500 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                        Enter values in plate wells to generate condition totals.
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
                        {useSequentialPreparationInstructions ? (
                            sequentialDilutionInstructions.map((step, index) => (
                                <div
                                    key={`prep-seq-${step.key}`}
                                    className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-200"
                                >
                                    <p className="font-medium">
                                        {index + 1}. {step.wellId} ({step.label})
                                    </p>
                                    {preparationMethod === "serial" ? (
                                        <>
                                            {step.diluentVolume <= 1e-12 ? (
                                                <p className="text-zinc-400 text-xs mt-1">
                                                    Use {step.sourceLabel} directly: prepare {formatVolumeWithAutoMicro(step.requiredTotalVolume, perWellVolumeUnit)} total (no diluent).
                                                </p>
                                            ) : (
                                                <p className="text-zinc-400 text-xs mt-1">
                                                    Mix {formatVolumeWithAutoMicro(step.transferVolume, perWellVolumeUnit)} of {step.sourceLabel} + {formatVolumeWithAutoMicro(step.diluentVolume, perWellVolumeUnit)} diluent to make {formatVolumeWithAutoMicro(step.requiredTotalVolume, perWellVolumeUnit)} total ({ratioLabel(step.stepFactor)} serial step{step.fromStart ? " from start" : ""}).
                                                </p>
                                            )}
                                            <p className="text-zinc-500 text-[11px] mt-1">
                                                Use {formatVolumeWithAutoMicro(step.dispenseVolume, perWellVolumeUnit)} for well {step.wellId}{step.transferToNext > 1e-12 ? ` and reserve ${formatVolumeWithAutoMicro(step.transferToNext, perWellVolumeUnit)} to prepare the next serial dilution.` : "."}
                                            </p>
                                        </>
                                    ) : (() => {
                                        const transferFromStart = step.dispenseVolume / Math.max(step.cumulativeFactor, 1e-12);
                                        const diluentFromStart = Math.max(step.dispenseVolume - transferFromStart, 0);
                                        if (diluentFromStart <= 1e-12) {
                                            return (
                                                <p className="text-zinc-400 text-xs mt-1">
                                                    Use start solution directly: prepare {formatVolumeWithAutoMicro(step.dispenseVolume, perWellVolumeUnit)} for well {step.wellId}.
                                                </p>
                                            );
                                        }
                                        return (
                                            <p className="text-zinc-400 text-xs mt-1">
                                                Mix {formatVolumeWithAutoMicro(transferFromStart, perWellVolumeUnit)} of start solution + {formatVolumeWithAutoMicro(diluentFromStart, perWellVolumeUnit)} diluent to make {formatVolumeWithAutoMicro(step.dispenseVolume, perWellVolumeUnit)} total for well {step.wellId} ({ratioLabel(step.cumulativeFactor)} total dilution from start).
                                            </p>
                                        );
                                    })()}
                                    <p className="text-zinc-500 text-[11px] mt-1">
                                        Final concentration after this step: {step.finalDisplay} (cumulative {ratioLabel(step.cumulativeFactor)}).
                                    </p>
                                    <p className="text-zinc-500 text-[11px] mt-1">
                                        Dispense {formatVolumeWithAutoMicro(parsePositiveNumber(perWellVolume) ?? 0, perWellVolumeUnit)} per well.
                                    </p>
                                </div>
                            ))
                        ) : (
                            analysis.summaries.map((summary, index) => (
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
                            ))
                        )}

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
