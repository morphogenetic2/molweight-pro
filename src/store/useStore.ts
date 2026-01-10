import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChemicalData } from "@/lib/parser";
import { Recipe, DEFAULT_RECIPES } from "@/lib/recipes";

interface AppState {
    activeTab: "home" | "mw" | "dilution" | "buffer_calc" | "buffer_recipe" | "molarity" | "help" | "stocks";
    setActiveTab: (tab: "home" | "mw" | "dilution" | "buffer_calc" | "buffer_recipe" | "molarity" | "help" | "stocks") => void;

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
        linkedSoluteId: string | null;
    };
    setDilution: (data: Partial<AppState["dilution"]>) => void;

    // Buffer State (Recipe Builder)
    bufferVolume: string;
    bufferUnit: string;
    solutes: any[]; // To be typed properly later
    setBufferVolume: (val: string) => void;
    setBufferUnit: (unit: string) => void;
    
    // Buffer Calculator State (Persistence)
    bufferConfig: {
        selectedBufferId: string;
        method: "salt_mix" | "titration";
        targetPH: number;
        totalVol: number;
        volUnit: "L" | "mL";
        totalConc: number;
        concUnit: "M" | "mM";
        selectedStockId: string;
    };
    setBufferConfig: (data: Partial<AppState["bufferConfig"]>) => void;

    addSolute: (data?: any) => void;
    updateSolute: (id: string, data: any) => void;
    removeSolute: (id: string) => void;
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

    // Theme
    theme: "dark" | "light";
    setTheme: (val: "dark" | "light") => void;

    // Stock Database
    stocks: Stock[];
    addStock: (stock: Stock) => void;
    updateStock: (id: string, data: Partial<Stock>) => void;
    removeStock: (id: string) => void;

    // Actions
    resetStore: () => void;
}

export interface Stock {
    id: string;
    name: string;
    formula: string;
    mw: number;
    conc: number; // Stored as number for ease (assuming Base Molarity or similar) - Actually let's store string to match other inputs? No, let's keep it robust.
    // Let's stick to the app's pattern: everything is string in inputs, but maybe we standardise here?
    // Let's store as strings to avoid precision issues until calc time.
    concentration: string;
    unit: string;
    volume?: string;
    volUnit?: string;
    dateAdded?: string;
    // Buffer Calculator extensions
    type?: "acid" | "base"; 
    concM?: number; // Molarity for calculator
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
                linkedSoluteId: null,
            },
            setDilution: (data) =>
                set((state) => ({ dilution: { ...state.dilution, ...data } })),

            bufferVolume: "100",
            bufferUnit: "mL",
            
            // Buffer Calculator State
            bufferConfig: {
                selectedBufferId: "tris",
                method: "salt_mix", // Default to salt mix as it's common
                targetPH: 7.4, // Default to physiological pH
                totalVol: 1,
                volUnit: "L",
                totalConc: 100, // Default to 100mM
                concUnit: "mM",
                selectedStockId: ""
            },
            setBufferConfig: (data) =>
                set((state) => ({ bufferConfig: { ...state.bufferConfig, ...data } })),

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

            // Theme
            theme: "dark",
            setTheme: (val) => set({ theme: val }),

            // Stocks Implementation
            stocks: [],
            addStock: (stock) => set((state) => ({ stocks: [...(state.stocks || []), stock] })),
            updateStock: (id, data) => set((state) => ({
                stocks: (state.stocks || []).map((s) => (s.id === id ? { ...s, ...data } : s))
            })),
            removeStock: (id) => set((state) => ({
                stocks: (state.stocks || []).filter((s) => s.id !== id)
            })),

            resetStore: () => {
                set({
                    mwInput: "",
                    mwResult: null,
                    dilution: {
                        c1: "", u1: "M", c2: "", u2: "M", v2: "", vu2: "mL",
                        mw: 0, name: "",
                        linkedSoluteId: null
                    },
                    solutes: [],
                    bufferVolume: "",
                    bufferUnit: "mL",
                    activeRecipeName: null,
                    
                    bufferConfig: {
                        selectedBufferId: "tris",
                        method: "salt_mix",
                        targetPH: 7.4,
                        totalVol: 1,
                        volUnit: "L",
                        totalConc: 100,
                        concUnit: "mM",
                        selectedStockId: ""
                    },

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
            }
        }),
        {
            name: "molweight-storage-v2",
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
