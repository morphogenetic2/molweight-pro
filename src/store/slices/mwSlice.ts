import type { StateCreator } from "zustand";
import type { AppState, MwSlice } from "@/store/storeTypes";

export const createMwSlice: StateCreator<AppState, [], [], MwSlice> = (set) => ({
    mwInput: "",
    setMwInput: (val) => set({ mwInput: val }),
    mwResult: null,
    setMwResult: (data) => set({ mwResult: data }),
    history: [],
    addToHistory: (data) =>
        set((state) => ({
            history: [data, ...state.history.filter((h) => h.formula !== data.formula)].slice(0, 10)
        }))
});
