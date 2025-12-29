import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChemicalData } from "@/lib/parser";
import { Recipe, DEFAULT_RECIPES } from "@/lib/recipes";

interface AppState {
    activeTab: "home" | "mw" | "dilution" | "buffer_calc" | "buffer_recipe" | "molarity";
    setActiveTab: (tab: "home" | "mw" | "dilution" | "buffer_calc" | "buffer_recipe" | "molarity") => void;

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
    updateSolute: (id: string, data: any) => void;
    removeSolute: (id: string) => void;
    clearSolutes: () => void;
    clearSolutes: () => void;
    activeRecipeName: string | null;

    // Molarity Calculator State
    molarityState: {
        mw: number;
        mass: string;
        volume: string;
        concentration: string;
        massUnit: string;
        volUnit: string;
        concUnit: string;
        target: "mass" | "volume" | "concentration" | "mw";
    };
    setMolarityState: (data: Partial<AppState["molarityState"]>) => void;

    // Recipe Library State
    savedRecipes: Recipe[];
    saveRecipe: (name: string, description: string) => void;
    loadRecipe: (recipe: Recipe) => void;
    deleteRecipe: (id: string) => void;

    // UI State
    isHistoryOpen: boolean;
    setIsHistoryOpen: (val: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (val: boolean) => void;
    isRecipeLibraryOpen: boolean;
    setIsRecipeLibraryOpen: (val: boolean) => void;
    isSaveRecipeOpen: boolean;
    setIsSaveRecipeOpen: (val: boolean) => void;

    // Actions
    resetStore: () => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            activeTab: "home",
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
            activeRecipeName: null,
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
            clearSolutes: () => set({ solutes: [], activeRecipeName: null }),

            molarityState: {
                mw: 0,
                mass: "",
                volume: "",
                concentration: "",
                massUnit: "g",
                volUnit: "L",
                concUnit: "M",
                target: "mass"
            },
            setMolarityState: (data) =>
                set((state) => ({ molarityState: { ...state.molarityState, ...data } })),

            savedRecipes: [],
            saveRecipe: (name, description) => set((state) => ({
                savedRecipes: [
                    ...state.savedRecipes,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        name,
                        description,
                        totalVolume: state.bufferVolume,
                        totalUnit: state.bufferUnit,
                        solutes: state.solutes
                    }
                ],
                isSaveRecipeOpen: false,
                activeRecipeName: name
            })),
            loadRecipe: (recipe) => set({
                bufferVolume: recipe.totalVolume,
                bufferUnit: recipe.totalUnit,
                activeRecipeName: recipe.name,
                solutes: recipe.solutes.map(s => ({
                    ...s,
                    id: Math.random().toString(36).substr(2, 9)
                }))
            }),
            deleteRecipe: (id) => set((state) => ({
                savedRecipes: state.savedRecipes.filter(r => r.id !== id)
            })),

            isHistoryOpen: false,
            setIsHistoryOpen: (val) => set({ isHistoryOpen: val }),
            isSettingsOpen: false,
            setIsSettingsOpen: (val) => set({ isSettingsOpen: val }),
            isRecipeLibraryOpen: false,
            setIsRecipeLibraryOpen: (val) => set({ isRecipeLibraryOpen: val }),
            isSaveRecipeOpen: false,
            setIsSaveRecipeOpen: (val) => set({ isSaveRecipeOpen: val }),

            resetStore: () => {
                set({
                    mwInput: "",
                    mwResult: null,
                    history: [],
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
                    bufferVolume: "100",
                    bufferUnit: "mL",
                    solutes: [],
                    activeRecipeName: null,
                    solutes: [],
                    activeRecipeName: null,
                    molarityState: {
                        mw: 0,
                        mass: "",
                        volume: "",
                        concentration: "",
                        massUnit: "g",
                        volUnit: "L",
                        concUnit: "M",
                        target: "mass"
                    }
                });
            },
        }),
        {
            name: "molweight-pro-storage",
            // Partial persistence: don't persist open states
            partialize: (state) => {
                const {
                    isHistoryOpen, isSettingsOpen,
                    isRecipeLibraryOpen, isSaveRecipeOpen,
                    ...rest
                } = state;
                return rest;
            },
        }
    )
);
