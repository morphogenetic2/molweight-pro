export type FillMode = "column" | "row";

export interface OrderedDilutionFactor {
    wellId: string;
    factor: number;
}

export interface OrderedDilutionFactorsResult {
    ordered: OrderedDilutionFactor[];
    blankOrderingApplied: boolean;
}

export interface SequentialDilutionStep {
    wellId: string;
    stepFactor: number;
    cumulativeFactor: number;
    sourceWellId: string | null;
    sourceStepFactor: number | null;
    finalConcentration: number;
    transferVolume: number;
    diluentVolume: number;
    fromStart: boolean;
    dispenseVolume: number;
    requiredTotalVolume: number;
    transferToNext: number;
}

export interface MonotonicEntry {
    wellId: string;
    concentration: number;
}

export interface MonotonicViolation {
    previousWellId: string;
    currentWellId: string;
    previousConcentration: number;
    currentConcentration: number;
}

export interface WellShadeStyle {
    backgroundColor: string;
    borderColor: string;
}

export interface LaneReplicateWrite {
    sourceWellId: string;
    targetWellId: string;
    raw: string;
}

export interface LaneReplicateSuggestion {
    axis: FillMode;
    sourceLane: number;
    targetLane: number;
    sourceLanes: number[];
    targetLanes: number[];
    lanePairs: Array<{ sourceLane: number; targetLane: number }>;
    sourceSequence: Array<{ sourceWellId: string; raw: string }>;
    writes: LaneReplicateWrite[];
    seriesLength: number;
}

interface Coord {
    row: number;
    col: number;
}

interface ParsedFactorEntry {
    wellId: string;
    index: number;
    row: number;
    col: number;
    factor: number;
}

const getCoord = (index: number, cols: number): Coord => ({
    row: Math.floor(index / cols),
    col: index % cols,
});

const distanceBetweenIndices = (a: number, b: number, cols: number): number => {
    const aCoord = getCoord(a, cols);
    const bCoord = getCoord(b, cols);
    return Math.abs(aCoord.row - bCoord.row) + Math.abs(aCoord.col - bCoord.col);
};

const normalizeRaw = (raw: string | undefined): string => (raw ?? "").trim();
const applyOverageToTotal = (baseVolume: number, overagePercent: number): number => {
    if (!Number.isFinite(baseVolume) || baseVolume <= 0) return 0;
    if (!Number.isFinite(overagePercent) || overagePercent <= 0) return baseVolume;
    return baseVolume + (baseVolume * overagePercent) / 100;
};

const chainKeyForCoord = (coord: Coord, fillMode: FillMode): string =>
    fillMode === "column" ? `c:${coord.col}` : `r:${coord.row}`;

const axisDistanceToBlank = (coord: Coord, blank: Coord, fillMode: FillMode): number =>
    fillMode === "column" ? Math.abs(coord.row - blank.row) : Math.abs(coord.col - blank.col);

const collectBlanks = (
    wellIds: string[],
    wellValues: Record<string, string>,
    cols: number,
    isBlank: (raw: string) => boolean
): Array<{ wellId: string; index: number; row: number; col: number }> =>
    wellIds
        .map((wellId, index) => ({ wellId, index, raw: normalizeRaw(wellValues[wellId]) }))
        .filter(({ raw }) => raw !== "" && isBlank(raw))
        .map(({ wellId, index }) => {
            const coord = getCoord(index, cols);
            return { wellId, index, row: coord.row, col: coord.col };
        });

const collectParsedFactors = (
    wellIds: string[],
    wellValues: Record<string, string>,
    cols: number,
    isBlank: (raw: string) => boolean,
    parseDilutionFactor: (raw: string) => number | null
): ParsedFactorEntry[] => {
    const parsed: ParsedFactorEntry[] = [];
    for (let index = 0; index < wellIds.length; index += 1) {
        const wellId = wellIds[index];
        const raw = normalizeRaw(wellValues[wellId]);
        if (!raw || isBlank(raw)) continue;
        const factor = parseDilutionFactor(raw);
        if (factor === null) continue;
        const coord = getCoord(index, cols);
        parsed.push({
            wellId,
            index,
            row: coord.row,
            col: coord.col,
            factor,
        });
    }
    return parsed;
};

const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = hex.replace("#", "");
    if (!/^[\da-fA-F]{6}$/.test(normalized)) {
        return `rgba(0, 0, 0, ${alpha})`;
    }
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function buildOrderedDilutionFactors(params: {
    wellIds: string[];
    wellValues: Record<string, string>;
    cols: number;
    isBlank: (raw: string) => boolean;
    parseDilutionFactor: (raw: string) => number | null;
}): OrderedDilutionFactorsResult {
    const { wellIds, wellValues, cols, isBlank, parseDilutionFactor } = params;

    const parsedFactors = collectParsedFactors(wellIds, wellValues, cols, isBlank, parseDilutionFactor);
    if (parsedFactors.length === 0) {
        return { ordered: [], blankOrderingApplied: false };
    }

    const blankIndices = collectBlanks(wellIds, wellValues, cols, isBlank).map((blank) => blank.index);
    if (blankIndices.length === 0) {
        return {
            ordered: parsedFactors
                .sort((a, b) => a.index - b.index)
                .map(({ wellId, factor }) => ({ wellId, factor })),
            blankOrderingApplied: false,
        };
    }

    const ranked = parsedFactors
        .map((entry) => ({
            ...entry,
            distanceToNearestBlank: Math.min(
                ...blankIndices.map((blankIndex) => distanceBetweenIndices(entry.index, blankIndex, cols))
            ),
        }))
        .sort((a, b) => {
            if (b.distanceToNearestBlank !== a.distanceToNearestBlank) {
                return b.distanceToNearestBlank - a.distanceToNearestBlank;
            }
            return a.index - b.index;
        })
        .map(({ wellId, factor }) => ({ wellId, factor }));

    return { ordered: ranked, blankOrderingApplied: true };
}

export function buildSequentialDilutionSteps(params: {
    orderedFactors: OrderedDilutionFactor[];
    startConcentration: number;
    perWellVolume: number;
    extraCount: number;
    overagePercent: number;
}): SequentialDilutionStep[] {
    const { orderedFactors, startConcentration, perWellVolume, extraCount, overagePercent } = params;
    if (orderedFactors.length === 0 || startConcentration <= 0 || perWellVolume <= 0) {
        return [];
    }

    const basePreparedVolumePerStep = perWellVolume * (1 + extraCount);
    const preparedVolumePerStep = applyOverageToTotal(basePreparedVolumePerStep, overagePercent);
    const requiredTotals = new Array<number>(orderedFactors.length).fill(0);

    for (let i = orderedFactors.length - 1; i >= 0; i -= 1) {
        let required = preparedVolumePerStep;
        if (i < orderedFactors.length - 1) {
            const nextFactor = orderedFactors[i + 1].factor;
            const transferToNext = requiredTotals[i + 1] / Math.max(nextFactor, 1e-12);
            required += transferToNext;
        }
        requiredTotals[i] = required;
    }

    let cumulativeFactor = 1;
    return orderedFactors.map((entry, index) => {
        cumulativeFactor *= entry.factor;
        const requiredTotalVolume = requiredTotals[index];
        const transferVolume = requiredTotalVolume / Math.max(entry.factor, 1e-12);
        const diluentVolume = Math.max(requiredTotalVolume - transferVolume, 0);
        const transferToNext =
            index < orderedFactors.length - 1
                ? requiredTotals[index + 1] / Math.max(orderedFactors[index + 1].factor, 1e-12)
                : 0;
        return {
            wellId: entry.wellId,
            stepFactor: entry.factor,
            cumulativeFactor,
            sourceWellId: index === 0 ? null : orderedFactors[index - 1].wellId,
            sourceStepFactor: index === 0 ? null : orderedFactors[index - 1].factor,
            finalConcentration: startConcentration / Math.max(cumulativeFactor, 1e-12),
            transferVolume,
            diluentVolume,
            fromStart: index === 0,
            dispenseVolume: preparedVolumePerStep,
            requiredTotalVolume,
            transferToNext,
        };
    });
}

export function findMonotonicIncreaseViolations(params: {
    entries: MonotonicEntry[];
    wellIds: string[];
    wellValues: Record<string, string>;
    cols: number;
    fillMode: FillMode;
    isBlank: (raw: string) => boolean;
}): MonotonicViolation[] {
    const { entries, wellIds, wellValues, cols, fillMode, isBlank } = params;
    if (entries.length < 2) return [];
    const entryByWellId = new Map(
        entries
            .filter((entry) => Number.isFinite(entry.concentration))
            .map((entry) => [entry.wellId, entry] as const)
    );
    if (entryByWellId.size < 2) return [];

    const rows = Math.ceil(wellIds.length / cols);
    const chainCount = fillMode === "column" ? cols : rows;
    const axisLength = fillMode === "column" ? rows : cols;

    const at = (chain: number, axisIndex: number): { wellId: string; raw: string } | null => {
        const row = fillMode === "column" ? axisIndex : chain;
        const col = fillMode === "column" ? chain : axisIndex;
        const index = row * cols + col;
        const wellId = wellIds[index];
        if (!wellId) return null;
        return { wellId, raw: normalizeRaw(wellValues[wellId]) };
    };

    const violations: MonotonicViolation[] = [];

    for (let chain = 0; chain < chainCount; chain += 1) {
        const segments: MonotonicEntry[][] = [];
        let currentSegment: MonotonicEntry[] = [];

        for (let axisIndex = 0; axisIndex < axisLength; axisIndex += 1) {
            const cell = at(chain, axisIndex);
            if (!cell) continue;

            if (cell.raw === "" || isBlank(cell.raw)) {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
                continue;
            }

            const entry = entryByWellId.get(cell.wellId);
            if (!entry) {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
                continue;
            }

            currentSegment.push(entry);
        }

        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        for (const segment of segments) {
            if (segment.length < 2) continue;

            // Infer each segment's own high-to-low orientation to avoid cross-series false positives.
            const first = segment[0];
            const last = segment[segment.length - 1];
            const ordered = first.concentration >= last.concentration
                ? segment
                : [...segment].reverse();

            for (let i = 1; i < ordered.length; i += 1) {
                const previous = ordered[i - 1];
                const current = ordered[i];
                const tolerance = Math.max(Math.abs(previous.concentration) * 1e-9, 1e-12);
                if (current.concentration > previous.concentration + tolerance) {
                    violations.push({
                        previousWellId: previous.wellId,
                        currentWellId: current.wellId,
                        previousConcentration: previous.concentration,
                        currentConcentration: current.concentration,
                    });
                }
            }
        }
    }

    return violations;
}

export function buildDilutionConcentrationMap(params: {
    wellIds: string[];
    wellValues: Record<string, string>;
    cols: number;
    fillMode: FillMode;
    startConcentration: number;
    isBlank: (raw: string) => boolean;
    parseDilutionFactor: (raw: string) => number | null;
}): { concentrationByWell: Map<string, number>; blankWellIds: Set<string> } {
    const { wellIds, wellValues, cols, fillMode, startConcentration, isBlank, parseDilutionFactor } = params;
    const concentrationByWell = new Map<string, number>();
    const blankWellIds = new Set<string>();

    for (const wellId of wellIds) {
        const raw = normalizeRaw(wellValues[wellId]);
        if (raw !== "" && isBlank(raw)) {
            blankWellIds.add(wellId);
        }
    }

    if (startConcentration <= 0) {
        return { concentrationByWell, blankWellIds };
    }

    const factorEntries = collectParsedFactors(wellIds, wellValues, cols, isBlank, parseDilutionFactor);
    if (factorEntries.length === 0) {
        return { concentrationByWell, blankWellIds };
    }

    const blanks = collectBlanks(wellIds, wellValues, cols, isBlank);
    if (blanks.length === 0) {
        for (const entry of factorEntries) {
            concentrationByWell.set(
                entry.wellId,
                startConcentration / Math.max(entry.factor, 1e-12)
            );
        }
        return { concentrationByWell, blankWellIds };
    }

    const factorByChain = new Map<string, ParsedFactorEntry[]>();
    for (const entry of factorEntries) {
        const key = chainKeyForCoord(entry, fillMode);
        const current = factorByChain.get(key) ?? [];
        current.push(entry);
        factorByChain.set(key, current);
    }

    const blanksByChain = new Map<string, Coord[]>();
    for (const blank of blanks) {
        const key = chainKeyForCoord(blank, fillMode);
        const current = blanksByChain.get(key) ?? [];
        current.push({ row: blank.row, col: blank.col });
        blanksByChain.set(key, current);
    }

    for (const [chainKey, entries] of factorByChain.entries()) {
        const chainBlanks = blanksByChain.get(chainKey) ?? [];
        if (chainBlanks.length === 0) {
            for (const entry of entries) {
                concentrationByWell.set(
                    entry.wellId,
                    startConcentration / Math.max(entry.factor, 1e-12)
                );
            }
            continue;
        }

        const ranked = entries
            .map((entry) => ({
                ...entry,
                distanceToNearestBlank: Math.min(
                    ...chainBlanks.map((blank) => axisDistanceToBlank(entry, blank, fillMode))
                ),
            }))
            .sort((a, b) => {
                if (b.distanceToNearestBlank !== a.distanceToNearestBlank) {
                    return b.distanceToNearestBlank - a.distanceToNearestBlank;
                }
                return a.index - b.index;
            });

        let cumulativeFactor = 1;
        for (const entry of ranked) {
            cumulativeFactor *= entry.factor;
            concentrationByWell.set(
                entry.wellId,
                startConcentration / Math.max(cumulativeFactor, 1e-12)
            );
        }
    }

    return { concentrationByWell, blankWellIds };
}

export function buildPerceptualShadeStyles(params: {
    concentrationByWell: Map<string, number>;
    blankWellIds: Set<string>;
    paletteHexLowToHigh: string[];
    backgroundAlpha: number;
    borderAlpha: number;
    blankStyle: WellShadeStyle;
}): Map<string, WellShadeStyle> {
    const {
        concentrationByWell,
        blankWellIds,
        paletteHexLowToHigh,
        backgroundAlpha,
        borderAlpha,
        blankStyle,
    } = params;
    const styleByWellId = new Map<string, WellShadeStyle>();
    const positiveValues = Array.from(concentrationByWell.values())
        .filter((value) => Number.isFinite(value) && value > 0);

    if (positiveValues.length > 0 && paletteHexLowToHigh.length > 0) {
        const logValues = positiveValues.map((value) => Math.log10(value));
        const minLog = Math.min(...logValues);
        const maxLog = Math.max(...logValues);
        const span = Math.max(maxLog - minLog, 1e-12);
        const lastBinIndex = paletteHexLowToHigh.length - 1;

        for (const [wellId, concentration] of concentrationByWell.entries()) {
            if (!Number.isFinite(concentration) || concentration <= 0) continue;
            const mapped = span <= 1e-12
                ? 1
                : (Math.log10(concentration) - minLog) / span;
            const clamped = Math.min(1, Math.max(0, mapped));
            const binIndex = Math.min(lastBinIndex, Math.floor(clamped * lastBinIndex + 1e-9));
            const hex = paletteHexLowToHigh[binIndex];
            styleByWellId.set(wellId, {
                backgroundColor: hexToRgba(hex, backgroundAlpha),
                borderColor: hexToRgba(hex, borderAlpha),
            });
        }
    }

    for (const wellId of blankWellIds.values()) {
        styleByWellId.set(wellId, blankStyle);
    }

    return styleByWellId;
}

export function detectLaneReplicateSuggestions(params: {
    wellIds: string[];
    wellValues: Record<string, string>;
    rows: number;
    cols: number;
    fillMode: FillMode;
    mode: "dilution" | "concentration";
    startConcentration: number;
    isBlank: (raw: string) => boolean;
    parseDilutionFactor: (raw: string) => number | null;
    parseConcentration: (raw: string) => number | null;
    minSeriesLength?: number;
}): LaneReplicateSuggestion[] {
    const {
        wellIds,
        wellValues,
        rows,
        cols,
        fillMode,
        mode,
        startConcentration,
        isBlank,
        parseDilutionFactor,
        parseConcentration,
        minSeriesLength = 3,
    } = params;

    const seriesAxisLength = fillMode === "column" ? rows : cols;
    const replicateAxisLength = fillMode === "column" ? cols : rows;
    const at = (seriesIndex: number, laneIndex: number): { index: number; coord: Coord; wellId: string; raw: string } => {
        const row = fillMode === "column" ? seriesIndex : laneIndex;
        const col = fillMode === "column" ? laneIndex : seriesIndex;
        const index = row * cols + col;
        const wellId = wellIds[index];
        const raw = normalizeRaw(wellValues[wellId]);
        return {
            index,
            coord: { row, col },
            wellId,
            raw,
        };
    };

    const isMonotonicDecrease = (values: number[]): boolean => {
        for (let i = 1; i < values.length; i += 1) {
            const previous = values[i - 1];
            const current = values[i];
            const tolerance = Math.max(Math.abs(previous) * 1e-9, 1e-12);
            if (current > previous + tolerance) {
                return false;
            }
        }
        return true;
    };

    const isValidMonotonicSeries = (
        orderedCells: Array<{ index: number; coord: Coord; wellId: string; raw: string }>
    ): boolean => {
        const filledCells = orderedCells.filter((cell) => cell.raw !== "");
        if (filledCells.length < minSeriesLength) return false;

        const blankCells = filledCells.filter((cell) => isBlank(cell.raw));
        const valueCells = filledCells.filter((cell) => !isBlank(cell.raw));
        if (valueCells.length < minSeriesLength - 1) return false;

        let rankedValueCells = valueCells;
        if (blankCells.length > 0) {
            const positionByWellId = new Map(
                orderedCells.map((cell, position) => [cell.wellId, position] as const)
            );
            rankedValueCells = valueCells
                .map((cell) => {
                    const cellPosition = positionByWellId.get(cell.wellId) ?? 0;
                    const nearestBlankDistance = Math.min(
                        ...blankCells.map((blank) => {
                            const blankPosition = positionByWellId.get(blank.wellId) ?? 0;
                            return Math.abs(cellPosition - blankPosition);
                        })
                    );
                    return {
                        ...cell,
                        cellPosition,
                        nearestBlankDistance,
                    };
                })
                .sort((a, b) => {
                    if (b.nearestBlankDistance !== a.nearestBlankDistance) {
                        return b.nearestBlankDistance - a.nearestBlankDistance;
                    }
                    return a.cellPosition - b.cellPosition;
                });
        }

        const comparable: number[] = [];
        if (mode === "dilution") {
            if (!(startConcentration > 0)) return false;
            let cumulative = 1;
            for (const cell of rankedValueCells) {
                const factor = parseDilutionFactor(cell.raw);
                if (!factor) return false;
                cumulative *= factor;
                comparable.push(startConcentration / Math.max(cumulative, 1e-12));
            }
        } else {
            for (const cell of rankedValueCells) {
                const conc = parseConcentration(cell.raw);
                if (!(conc !== null && Number.isFinite(conc) && conc > 0)) {
                    return false;
                }
                comparable.push(conc);
            }
        }

        return isMonotonicDecrease(comparable);
    };

    const bestSuggestionByTargetStart = new Map<number, LaneReplicateSuggestion>();

    for (let sourceStart = 0; sourceStart < replicateAxisLength; sourceStart += 1) {
        for (let width = 1; sourceStart + width <= replicateAxisLength; width += 1) {
            const sourceLanes = Array.from({ length: width }, (_, idx) => sourceStart + idx);
            const perLaneFilledCounts = sourceLanes.map((lane) =>
                Array.from({ length: seriesAxisLength }, (_, seriesIndex) => at(seriesIndex, lane))
                    .filter((cell) => cell.raw !== "").length
            );
            if (perLaneFilledCounts.some((count) => count === 0)) {
                break;
            }

            const laneOrderOptions = [sourceLanes, [...sourceLanes].reverse()];
            let sourceSequence: Array<{ sourceWellId: string; raw: string }> | null = null;
            for (const orderedLanes of laneOrderOptions) {
                const orderedCells = orderedLanes.flatMap((lane) =>
                    Array.from({ length: seriesAxisLength }, (_, seriesIndex) => at(seriesIndex, lane))
                );
                if (!isValidMonotonicSeries(orderedCells)) {
                    continue;
                }
                sourceSequence = orderedCells
                    .filter((cell) => cell.raw !== "")
                    .map((cell) => ({ sourceWellId: cell.wellId, raw: cell.raw }));
                break;
            }
            if (!sourceSequence || sourceSequence.length < minSeriesLength) {
                continue;
            }

            const targetStarts = [sourceStart - width, sourceStart + width]
                .filter((targetStart) => targetStart >= 0 && targetStart + width <= replicateAxisLength);

            for (const targetStart of targetStarts) {
                const targetLanes = Array.from({ length: width }, (_, idx) => targetStart + idx);
                const lanePairs = sourceLanes.map((sourceLane, idx) => ({
                    sourceLane,
                    targetLane: targetLanes[idx],
                }));

                const writes: LaneReplicateWrite[] = [];
                let targetHasConflicts = false;

                for (const pair of lanePairs) {
                    for (let seriesIndex = 0; seriesIndex < seriesAxisLength; seriesIndex += 1) {
                        const sourceCell = at(seriesIndex, pair.sourceLane);
                        if (sourceCell.raw === "") continue;
                        const targetCell = at(seriesIndex, pair.targetLane);
                        if (targetCell.raw !== "") {
                            targetHasConflicts = true;
                            break;
                        }
                        writes.push({
                            sourceWellId: sourceCell.wellId,
                            targetWellId: targetCell.wellId,
                            raw: sourceCell.raw,
                        });
                    }
                    if (targetHasConflicts) break;
                }

                if (targetHasConflicts || writes.length === 0) {
                    continue;
                }

                const suggestion: LaneReplicateSuggestion = {
                    axis: fillMode,
                    sourceLane: sourceLanes[0],
                    targetLane: targetLanes[0],
                    sourceLanes,
                    targetLanes,
                    lanePairs,
                    sourceSequence,
                    writes,
                    seriesLength: writes.length,
                };

                const existing = bestSuggestionByTargetStart.get(targetStart);
                if (
                    !existing ||
                    suggestion.targetLanes.length > existing.targetLanes.length ||
                    suggestion.seriesLength > existing.seriesLength
                ) {
                    bestSuggestionByTargetStart.set(targetStart, suggestion);
                }
            }
        }
    }

    return Array.from(bestSuggestionByTargetStart.values()).sort((a, b) => a.targetLane - b.targetLane);
}
