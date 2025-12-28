import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChemicalData } from "@/lib/parser";

interface AppState {
    activeTab: "mw" | "dilution" | "buffer";
    setActiveTab: (tab: "mw" | "dilution" | "buffer") => void;

    // MW Calculator State
    mwInput: string;
    setMwInput: (val: string) => void;
    mwResult: ChemicalData | null;
    setMwResult: (data: ChemicalData | null) => void;
    history: ChemicalData[];
    addToHistory: (data: ChemicalData) => void;

    // Dilution State
    dilution: {
        name: string;
        mw: number;
        c1: string;
        u1: string;
        c2: string;
        u2: string;
        v2: string;
        vu2: string;
    };
    setDilution: (data: Partial<AppState["dilution"]>) => void;

    // Buffer State
    bufferVolume: string;
    bufferUnit: string;
    solutes: any[]; // To be typed properly later
    setBufferVolume: (val: string) => void;
    setBufferUnit: (unit: string) => void;
    addSolute: (data?: any) => void;
    removeSolute: (id: string) => void;
    updateSolute: (id: string, data: any) => void;
    clearSolutes: () => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            activeTab: "mw",
            setActiveTab: (tab) => set({ activeTab: tab }),

            mwInput: "",
            setMwInput: (val) => set({ mwInput: val }),
            mwResult: null,
            setMwResult: (data) => set({ mwResult: data }),
            history: [],
            addToHistory: (data) =>
                set((state) => ({
                    history: [data, ...state.history.filter((h) => h.formula !== data.formula)].slice(0, 10),
                })),

            dilution: {
                name: "",
                mw: 0,
                c1: "",
                u1: "M",
                c2: "",
                u2: "M",
                v2: "",
                vu2: "mL",
            },
            setDilution: (data) =>
                set((state) => ({ dilution: { ...state.dilution, ...data } })),

            bufferVolume: "100",
            bufferUnit: "mL",
            solutes: [],
            setBufferVolume: (val) => set({ bufferVolume: val }),
            setBufferUnit: (unit) => set({ bufferUnit: unit }),
            addSolute: (initialData?: any) =>
                set((state) => ({
                    solutes: [
                        ...state.solutes,
                        {
                            id: Math.random().toString(36).substr(2, 9),
                            name: "",
                            mw: "",
                            conc: "1",
                            unit: "M",
                            ...initialData
                        },
                    ],
                })),
            removeSolute: (id) =>
                set((state) => ({
                    solutes: state.solutes.filter((s) => s.id !== id),
                })),
            updateSolute: (id, data) =>
                set((state) => ({
                    solutes: state.solutes.map((s) => (s.id === id ? { ...s, ...data } : s)),
                })),
            clearSolutes: () => set({ solutes: [] }),
        }),
        {
            name: "molweight-pro-storage",
        }
    )
);
