import type { StateCreator } from "zustand";
import type { AppState, SerialDilutionSlice, SerialDilutionState } from "@/store/storeTypes";

export const DEFAULT_SERIAL_DILUTION: SerialDilutionState = {
    mode: "auto",
    seriesType: "dilution",
    autoStopMode: "target",
    stockConcentration: "100",
    startConcentration: "100",
    targetConcentration: "1",
    targetConcentrationUnit: "mM",
    concentrationUnit: "mM",
    finalVolume: "1",
    volumeUnit: "mL",
    replicates: 1,
    overagePercent: 0,
    includeBlank: false,
    stepCount: 4,
    autoDilutionFactor: "1:10",
    autoConcentrationStep: "10",
    customStepInputs: ["", "", "", ""],
};

export const createSerialDilutionSlice: StateCreator<AppState, [], [], SerialDilutionSlice> = (set) => ({
    serialDilutionState: DEFAULT_SERIAL_DILUTION,
    setSerialDilutionState: (data) =>
        set((state) => ({ serialDilutionState: { ...state.serialDilutionState, ...data } })),
    resetSerialDilutionState: () => set({ serialDilutionState: DEFAULT_SERIAL_DILUTION }),
});
