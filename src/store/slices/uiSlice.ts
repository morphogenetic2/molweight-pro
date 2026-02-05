import type { StateCreator } from "zustand";
import type { AppState, UiSlice } from "@/store/storeTypes";

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
    setTheme: (val) => set({ theme: val })
});
