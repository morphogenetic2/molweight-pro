import type { StateCreator } from "zustand";
import type { AppState, SerialDilutionSlice, SerialDilutionState } from "@/store/storeTypes";

export const DEFAULT_SERIAL_DILUTION: SerialDilutionState = {
    mode: "auto",
    stockConcentration: "100",
    startConcentration: "100",
    targetConcentration: "1",
    concentrationUnit: "mM",
    finalVolume: "1",
    volumeUnit: "mL",
    replicates: 1,
    extraSamples: 0,
    overagePercent: 0,
    autoRatio: "1:10",
    customRatios: "1:2, 1:2, 1:2, 1:2",
    exactLastStep: false,
    minPipetteVolumeUl: 0.2,
};

export const createSerialDilutionSlice: StateCreator<AppState, [], [], SerialDilutionSlice> = (set) => ({
    serialDilutionState: DEFAULT_SERIAL_DILUTION,
    setSerialDilutionState: (data) =>
        set((state) => ({ serialDilutionState: { ...state.serialDilutionState, ...data } })),
    resetSerialDilutionState: () => set({ serialDilutionState: DEFAULT_SERIAL_DILUTION }),
});
