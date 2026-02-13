import type { StateCreator } from "zustand";
import type { AppState, BufferRecipeSlice } from "@/store/storeTypes";
import { createId } from "@/lib/id";

export const DEFAULT_BUFFER_VOLUME = "100";
export const DEFAULT_BUFFER_UNIT = "mL";

export const createBufferRecipeSlice: StateCreator<AppState, [], [], BufferRecipeSlice> = (set) => ({
    bufferVolume: DEFAULT_BUFFER_VOLUME,
    bufferUnit: DEFAULT_BUFFER_UNIT,
    solutes: [],
    activeRecipeName: null,
    setBufferVolume: (val) => set({ bufferVolume: val }),
    setBufferUnit: (unit) => set({ bufferUnit: unit }),
    addSolute: (initialData) =>
        set((state) => ({
            solutes: [
                ...state.solutes,
                {
                    id: createId(),
                    name: "",
                    mw: "",
                    conc: "1",
                    unit: "M",
                    ...initialData
                }
            ]
        })),
    removeSolute: (id) =>
        set((state) => ({
            solutes: state.solutes.filter((s) => s.id !== id)
        })),
    updateSolute: (id, data) =>
        set((state) => ({
            solutes: state.solutes.map((s) => (s.id === id ? { ...s, ...data } : s))
        })),
    clearSolutes: () => set({ solutes: [], activeRecipeName: null })
});
