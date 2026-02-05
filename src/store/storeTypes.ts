import { ChemicalData } from "@/lib/parser";
import { Recipe } from "@/lib/recipes";

export type ActiveTab =
    | "home"
    | "mw"
    | "dilution"
    | "buffer_calc"
    | "buffer_recipe"
    | "molarity"
    | "help"
    | "stocks";

export interface Stock {
    id: string;
    name: string;
    formula: string;
    mw: number;
    conc: number;
    concentration: string;
    unit: string;
    volume?: string;
    volUnit?: string;
    dateAdded?: string;
    type?: "acid" | "base";
    concM?: number;
}

export interface AdjustmentStock {
    id: string;
    name: string;
    concM: number;
    type: "acid" | "base";
}

export interface UiSlice {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;

    isHistoryOpen: boolean;
    setIsHistoryOpen: (val: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (val: boolean) => void;
    isRecipeLibraryOpen: boolean;
    setIsRecipeLibraryOpen: (val: boolean) => void;
    isSaveRecipeOpen: boolean;
    setIsSaveRecipeOpen: (val: boolean) => void;

    theme: "dark" | "light";
    setTheme: (val: "dark" | "light") => void;
}

export interface MwSlice {
    mwInput: string;
    setMwInput: (val: string) => void;
    mwResult: ChemicalData | null;
    setMwResult: (data: ChemicalData | null) => void;
    history: ChemicalData[];
    addToHistory: (data: ChemicalData) => void;
}

export interface DilutionState {
    name: string;
    mw: number;
    c1: string;
    u1: string;
    c2: string;
    u2: string;
    v2: string;
    vu2: string;
    linkedSoluteId: string | null;
}

export interface DilutionSlice {
    dilution: DilutionState;
    setDilution: (data: Partial<DilutionState>) => void;
}

export interface BufferRecipeSlice {
    bufferVolume: string;
    bufferUnit: string;
    solutes: Solute[];
    setBufferVolume: (val: string) => void;
    setBufferUnit: (unit: string) => void;
    addSolute: (data?: Partial<Solute>) => void;
    updateSolute: (id: string, data: Partial<Solute>) => void;
    removeSolute: (id: string) => void;
    clearSolutes: () => void;
    activeRecipeName: string | null;
}

export interface Solute {
    id: string;
    name: string;
    mw: string | number;
    conc: string | number;
    unit: string;
    formula?: string;
    done?: boolean;
    isStock?: boolean;
    stockConc?: string;
    stockUnit?: string;
    concentration?: string;
    volume?: string;
    volUnit?: string;
    [key: string]: unknown;
}

export interface BufferConfig {
    selectedBufferId: string;
    method: "salt_mix" | "titration";
    targetPH: number;
    totalVol: number;
    volUnit: "L" | "mL";
    totalConc: number;
    concUnit: "M" | "mM";
    selectedStockId: string;
}

export interface BufferCalcSlice {
    bufferConfig: BufferConfig;
    setBufferConfig: (data: Partial<BufferConfig>) => void;
}

export interface MolarityState {
    mw: number;
    mass: string;
    volume: string;
    concentration: string;
    massUnit: string;
    volUnit: string;
    concUnit: string;
    target: "mass" | "volume" | "concentration" | "mw";
}

export interface MolaritySlice {
    molarityState: MolarityState;
    setMolarityState: (data: Partial<MolarityState>) => void;
}

export interface RecipesSlice {
    savedRecipes: Recipe[];
    saveRecipe: (name: string, description: string) => void;
    loadRecipe: (recipe: Recipe) => void;
    deleteRecipe: (id: string) => void;
}

export interface StocksSlice {
    stocks: Stock[];
    addStock: (stock: Stock) => void;
    updateStock: (id: string, data: Partial<Stock>) => void;
    removeStock: (id: string) => void;

    adjustmentStocks: AdjustmentStock[];
    addAdjustmentStock: (stock: AdjustmentStock) => void;
    updateAdjustmentStock: (id: string, data: Partial<AdjustmentStock>) => void;
    removeAdjustmentStock: (id: string) => void;
}

export interface AppState
    extends UiSlice,
        MwSlice,
        DilutionSlice,
        BufferRecipeSlice,
        BufferCalcSlice,
        MolaritySlice,
        RecipesSlice,
        StocksSlice {
    resetStore: () => void;
}
