import type { StateCreator } from "zustand";
import type { AppState, DilutionSlice, DilutionState } from "@/store/storeTypes";

export const DEFAULT_DILUTION: DilutionState = {
    name: "",
    mw: 0,
    c1: "",
    u1: "M",
    c2: "",
    u2: "M",
    v2: "",
    vu2: "mL",
    linkedSoluteId: null
};

export const createDilutionSlice: StateCreator<AppState, [], [], DilutionSlice> = (set) => ({
    dilution: DEFAULT_DILUTION,
    setDilution: (data) =>
        set((state) => ({ dilution: { ...state.dilution, ...data } }))
});
