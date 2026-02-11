import type { StateCreator } from "zustand";
import type { AppState, UiSlice } from "@/store/storeTypes";

export const DEFAULT_MOLECULE_SETTINGS: AppState["moleculeSettings"] = {
    bondThickness: 1.5,
    bondLength: 20,
    shortBondLength: 0.8,
    bondSpacing: 3.6, // 0.18 * 20
    atomVisualization: "default",
    terminalCarbons: false,
    explicitHydrogens: false,
    overlapSensitivity: 0.42,
    fontSizeLarge: 10,
    fontSizeSmall: 7,
    padding: 20,
    maxRenderSize: 320,
};

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
    activeTab: "home",
    setActiveTab: (tab) => set({ activeTab: tab }),

    isHistoryOpen: false,
    setIsHistoryOpen: (val) => set({ isHistoryOpen: val }),
    isSettingsOpen: false,
    setIsSettingsOpen: (val) => set({ isSettingsOpen: val }),
    isRecipeLibraryOpen: false,
    setIsRecipeLibraryOpen: (val) => set({ isRecipeLibraryOpen: val }),
    isSaveRecipeOpen: false,
    setIsSaveRecipeOpen: (val) => set({ isSaveRecipeOpen: val }),

    theme: "dark",
    setTheme: (val) => set({ theme: val }),

    moleculeSettings: DEFAULT_MOLECULE_SETTINGS,
    updateMoleculeSettings: (val) => set((state) => ({ 
        moleculeSettings: { ...state.moleculeSettings, ...val } 
    }))
});
