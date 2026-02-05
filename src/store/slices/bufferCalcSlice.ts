import type { StateCreator } from "zustand";
import type { AppState, BufferCalcSlice, BufferConfig } from "@/store/storeTypes";

export const DEFAULT_BUFFER_CONFIG: BufferConfig = {
    selectedBufferId: "tris",
    method: "salt_mix",
    targetPH: 7.4,
    totalVol: 1,
    volUnit: "L",
    totalConc: 100,
    concUnit: "mM",
    selectedStockId: ""
};

export const createBufferCalcSlice: StateCreator<AppState, [], [], BufferCalcSlice> = (set) => ({
    bufferConfig: DEFAULT_BUFFER_CONFIG,
    setBufferConfig: (data) =>
        set((state) => ({ bufferConfig: { ...state.bufferConfig, ...data } }))
});
