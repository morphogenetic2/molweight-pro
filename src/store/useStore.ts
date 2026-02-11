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
                    adjustmentStocks: DEFAULT_ADJUSTMENT_STOCKS
                });
            }
        }),
        {
            name: "molweight-storage-v2",
            version: 4,
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
                const allowedPipetteMinimums = new Set([0.001, 0.01, 0.02, 0.2, 1]);
                const allowedOveragePercents = new Set([0, 10, 15]);
                const minPipetteVolumeUl =
                    typeof serialState.minPipetteVolumeUl === "number" &&
                    allowedPipetteMinimums.has(serialState.minPipetteVolumeUl)
                        ? serialState.minPipetteVolumeUl
                        : DEFAULT_SERIAL_DILUTION.minPipetteVolumeUl;
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
                const extraSamples =
                    typeof serialState.extraSamples === "number" &&
                    Number.isInteger(serialState.extraSamples) &&
                    serialState.extraSamples >= 0
                        ? serialState.extraSamples
                        : DEFAULT_SERIAL_DILUTION.extraSamples;
                const stockConcentration =
                    typeof serialState.stockConcentration === "string" && serialState.stockConcentration.trim() !== ""
                        ? serialState.stockConcentration
                        : DEFAULT_SERIAL_DILUTION.stockConcentration;
                state.serialDilutionState = {
                    ...DEFAULT_SERIAL_DILUTION,
                    ...serialState,
                    mode,
                    stockConcentration,
                    exactLastStep: Boolean(serialState.exactLastStep),
                    minPipetteVolumeUl,
                    overagePercent,
                    replicates,
                    extraSamples,
                };

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
