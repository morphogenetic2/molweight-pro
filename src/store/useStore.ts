import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppState, AdjustmentStock } from "@/store/storeTypes";
import { createUiSlice } from "@/store/slices/uiSlice";
import { createMwSlice } from "@/store/slices/mwSlice";
import { createDilutionSlice, DEFAULT_DILUTION } from "@/store/slices/dilutionSlice";
import { createBufferRecipeSlice } from "@/store/slices/bufferRecipeSlice";
import { createBufferCalcSlice, DEFAULT_BUFFER_CONFIG } from "@/store/slices/bufferCalcSlice";
import { createMolaritySlice, DEFAULT_MOLARITY } from "@/store/slices/molaritySlice";
import { createSerialDilutionSlice, DEFAULT_SERIAL_DILUTION } from "@/store/slices/serialDilutionSlice";
import { createRecipesSlice } from "@/store/slices/recipesSlice";
import { createStocksSlice, DEFAULT_ADJUSTMENT_STOCKS } from "@/store/slices/stocksSlice";
import { DEFAULT_MOLECULE_SETTINGS } from "@/store/slices/uiSlice";
import { createDensitySlice, DEFAULT_LIQUID_DENSITIES } from "@/store/slices/densitySlice";

export const useStore = create<AppState>()(
    persist(
        (set, get, api) => ({
            ...createUiSlice(set, get, api),
            ...createMwSlice(set, get, api),
            ...createDilutionSlice(set, get, api),
            ...createBufferRecipeSlice(set, get, api),
            ...createBufferCalcSlice(set, get, api),
            ...createMolaritySlice(set, get, api),
            ...createSerialDilutionSlice(set, get, api),
            ...createRecipesSlice(set, get, api),
            ...createStocksSlice(set, get, api),
            ...createDensitySlice(set, get, api),

            resetStore: () => {
                set({
                    mwInput: "",
                    mwResult: null,
                    dilution: DEFAULT_DILUTION,
                    solutes: [],
                    bufferVolume: "",
                    bufferUnit: "mL",
                    activeRecipeName: null,
                    bufferConfig: DEFAULT_BUFFER_CONFIG,
                    molarityState: DEFAULT_MOLARITY,
                    serialDilutionState: DEFAULT_SERIAL_DILUTION,
                    adjustmentStocks: DEFAULT_ADJUSTMENT_STOCKS,
                    liquidDensities: DEFAULT_LIQUID_DENSITIES,
                });
            }
        }),
        {
            name: "molweight-storage-v2",
            version: 6,
            migrate: (persistedState: unknown) => {
                const state = (typeof persistedState === "object" && persistedState !== null
                    ? { ...(persistedState as Record<string, unknown>) }
                    : {}) as Partial<AppState> & Record<string, unknown>;
                const stocks = Array.isArray(state.stocks) ? (state.stocks as unknown[]) : [];
                const hasAdjusters = Array.isArray(state.adjustmentStocks);

                if (!hasAdjusters) {
                    const isLegacyAdjuster = (value: unknown): value is AdjustmentStock & { concentration?: string | null } => {
                        if (!value || typeof value !== "object") return false;
                        const v = value as Record<string, unknown>;
                        return (
                            typeof v.id === "string" &&
                            typeof v.name === "string" &&
                            typeof v.concM === "number" &&
                            (v.type === "acid" || v.type === "base")
                        );
                    };

                    const hasId = (value: unknown): value is { id: string } => {
                        if (!value || typeof value !== "object") return false;
                        const v = value as Record<string, unknown>;
                        return typeof v.id === "string";
                    };

                    const legacyAdjusters = stocks.filter(
                        (s): s is AdjustmentStock & { concentration?: string | null } =>
                            isLegacyAdjuster(s) &&
                            (((s as { concentration?: string | null }).concentration ?? "") === "")
                    );

                    if (legacyAdjusters.length > 0) {
                        state.adjustmentStocks = legacyAdjusters.map((s) => ({
                            id: s.id,
                            name: s.name,
                            concM: s.concM,
                            type: s.type
                        })) as AdjustmentStock[];

                        const legacyIds = new Set(legacyAdjusters.map((s) => s.id));
                        state.stocks = stocks.filter((s) => !hasId(s) || !legacyIds.has(s.id)) as AppState["stocks"];
                    } else {
                        state.adjustmentStocks = DEFAULT_ADJUSTMENT_STOCKS;
                    }
                }

                const moleculeSettings = state.moleculeSettings as unknown;
                const rawMoleculeSettings =
                    typeof moleculeSettings === "object" && moleculeSettings !== null
                        ? (moleculeSettings as Record<string, unknown>)
                        : {};

                const rawAtomVisualization = rawMoleculeSettings.atomVisualization;
                const mappedAtomVisualization =
                    rawAtomVisualization === "avg"
                        ? "default"
                        : rawAtomVisualization === "ball"
                            ? "balls"
                            : rawAtomVisualization === "default" ||
                                rawAtomVisualization === "balls" ||
                                rawAtomVisualization === "none"
                                ? rawAtomVisualization
                                : DEFAULT_MOLECULE_SETTINGS.atomVisualization;

                const rawMaxRenderSize = rawMoleculeSettings.maxRenderSize;
                const mappedMaxRenderSize =
                    typeof rawMaxRenderSize === "number"
                        ? Math.min(400, Math.max(180, rawMaxRenderSize))
                        : DEFAULT_MOLECULE_SETTINGS.maxRenderSize;

                state.moleculeSettings = {
                    ...DEFAULT_MOLECULE_SETTINGS,
                    ...rawMoleculeSettings,
                    atomVisualization: mappedAtomVisualization,
                    maxRenderSize: mappedMaxRenderSize,
                } as AppState["moleculeSettings"];

                const rawSerialState = state.serialDilutionState as unknown;
                const serialState =
                    typeof rawSerialState === "object" && rawSerialState !== null
                        ? (rawSerialState as Partial<typeof DEFAULT_SERIAL_DILUTION>)
                        : {};

                const mode = serialState.mode === "custom" ? "custom" : "auto";
                const seriesType =
                    serialState.seriesType === "concentration" ? "concentration" : "dilution";
                const autoStopMode = serialState.autoStopMode === "steps" ? "steps" : "target";
                const allowedOveragePercents = new Set([0, 5, 10, 20]);
                const overagePercent =
                    typeof serialState.overagePercent === "number" &&
                    allowedOveragePercents.has(serialState.overagePercent)
                        ? serialState.overagePercent
                        : DEFAULT_SERIAL_DILUTION.overagePercent;
                const replicates =
                    typeof serialState.replicates === "number" &&
                    Number.isInteger(serialState.replicates) &&
                    serialState.replicates >= 1
                        ? serialState.replicates
                        : DEFAULT_SERIAL_DILUTION.replicates;
                const stepCount =
                    typeof serialState.stepCount === "number" &&
                    Number.isInteger(serialState.stepCount) &&
                    serialState.stepCount >= 1 &&
                    serialState.stepCount <= 200
                        ? serialState.stepCount
                        : DEFAULT_SERIAL_DILUTION.stepCount;
                const stockConcentration =
                    typeof serialState.stockConcentration === "string" && serialState.stockConcentration.trim() !== ""
                        ? serialState.stockConcentration
                        : DEFAULT_SERIAL_DILUTION.stockConcentration;
                const targetConcentrationUnit =
                    typeof serialState.targetConcentrationUnit === "string" &&
                    serialState.targetConcentrationUnit.trim() !== ""
                        ? serialState.targetConcentrationUnit
                        : typeof serialState.concentrationUnit === "string" &&
                            serialState.concentrationUnit.trim() !== ""
                            ? serialState.concentrationUnit
                            : DEFAULT_SERIAL_DILUTION.targetConcentrationUnit;
                const includeBlank = Boolean(serialState.includeBlank);
                const autoDilutionFactor =
                    typeof serialState.autoDilutionFactor === "string" && serialState.autoDilutionFactor.trim() !== ""
                        ? serialState.autoDilutionFactor
                        : typeof (serialState as Record<string, unknown>).autoRatio === "string"
                            ? ((serialState as Record<string, unknown>).autoRatio as string)
                            : DEFAULT_SERIAL_DILUTION.autoDilutionFactor;
                const autoConcentrationStep =
                    typeof serialState.autoConcentrationStep === "string" && serialState.autoConcentrationStep.trim() !== ""
                        ? serialState.autoConcentrationStep
                        : DEFAULT_SERIAL_DILUTION.autoConcentrationStep;
                const legacyCustomRatios =
                    typeof (serialState as Record<string, unknown>).customRatios === "string"
                        ? ((serialState as Record<string, unknown>).customRatios as string)
                        : "";
                const fallbackCustomInputs = legacyCustomRatios
                    .split(/[,;\n]+/)
                    .map((token) => token.trim())
                    .filter((token) => token.length > 0);
                const customStepInputs = Array.isArray(serialState.customStepInputs)
                    ? serialState.customStepInputs
                        .filter((token): token is string => typeof token === "string")
                        .map((token) => token.trim())
                    : fallbackCustomInputs;
                const hasOnlyLegacyDilutionDefaults =
                    customStepInputs.length > 0 &&
                    customStepInputs.every((token) => token === "1:2");
                const normalizedCustomStepInputs =
                    customStepInputs.length > 0 && !hasOnlyLegacyDilutionDefaults
                        ? Array.from({ length: stepCount }, (_, index) => customStepInputs[index] ?? "")
                        : Array.from({ length: stepCount }, (_, index) =>
                            DEFAULT_SERIAL_DILUTION.customStepInputs[index] ?? ""
                        );
                state.serialDilutionState = {
                    ...DEFAULT_SERIAL_DILUTION,
                    ...serialState,
                    mode,
                    seriesType,
                    autoStopMode,
                    stockConcentration,
                    targetConcentrationUnit,
                    overagePercent,
                    replicates,
                    includeBlank,
                    stepCount,
                    autoDilutionFactor,
                    autoConcentrationStep,
                    customStepInputs: normalizedCustomStepInputs,
                };

                const allowedTabs = new Set([
                    "home",
                    "mw",
                    "dilution",
                    "serial_dilution",
                    "buffer_calc",
                    "buffer_recipe",
                    "molarity",
                    "help",
                    "stocks",
                ]);
                const rawActiveTab = state.activeTab;
                state.activeTab =
                    typeof rawActiveTab === "string" && allowedTabs.has(rawActiveTab)
                        ? rawActiveTab
                        : "home";

                const rawLiquidDensities: unknown[] = Array.isArray(
                    (state as Record<string, unknown>).liquidDensities
                )
                    ? ((state as Record<string, unknown>).liquidDensities as unknown[])
                    : [];
                state.liquidDensities = rawLiquidDensities
                    .map((entry) => {
                        if (!entry || typeof entry !== "object") return null;
                        const cast = entry as Record<string, unknown>;
                        const cid = Number(cast.cid);
                        const density = Number(cast.density);
                        const name = typeof cast.name === "string" ? cast.name.trim() : "";
                        if (!Number.isInteger(cid) || cid <= 0) return null;
                        if (!Number.isFinite(density) || density <= 0) return null;
                        if (!name) return null;
                        return { cid, density, name };
                    })
                    .filter(
                        (entry): entry is { cid: number; density: number; name: string } =>
                            entry !== null
                    );

                return state;
            },
            partialize: (state) => {
                const {
                    isHistoryOpen: _isHistoryOpen,
                    isSettingsOpen: _isSettingsOpen,
                    isRecipeLibraryOpen: _isRecipeLibraryOpen,
                    isSaveRecipeOpen: _isSaveRecipeOpen,
                    ...rest
                } = state;
                void _isHistoryOpen;
                void _isSettingsOpen;
                void _isRecipeLibraryOpen;
                void _isSaveRecipeOpen;
                return rest;
            }
        }
    )
);
