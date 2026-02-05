import type { StateCreator } from "zustand";
import type { AppState, MolaritySlice, MolarityState } from "@/store/storeTypes";

export const DEFAULT_MOLARITY: MolarityState = {
    mw: 0,
    mass: "",
    volume: "",
    concentration: "",
    massUnit: "g",
    volUnit: "L",
    concUnit: "M",
    target: "mass"
};

export const createMolaritySlice: StateCreator<AppState, [], [], MolaritySlice> = (set) => ({
    molarityState: DEFAULT_MOLARITY,
    setMolarityState: (data) =>
        set((state) => ({ molarityState: { ...state.molarityState, ...data } }))
});
