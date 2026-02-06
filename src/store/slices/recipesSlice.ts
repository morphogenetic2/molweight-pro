import type { StateCreator } from "zustand";
import type { AppState, RecipesSlice } from "@/store/storeTypes";

export const createRecipesSlice: StateCreator<AppState, [], [], RecipesSlice> = (set) => ({
    savedRecipes: [],
    saveRecipe: (name, description) =>
        set((state) => ({
            savedRecipes: [
                ...state.savedRecipes,
                {
                    id: Math.random().toString(36).substr(2, 9),
                    name,
                    description,
                    totalVolume: state.bufferVolume,
                    totalUnit: state.bufferUnit,
                    solutes: state.solutes.map((s) => ({
                        name: s.name,
                        mw: String(s.mw),
                        conc: String(s.conc),
                        unit: s.unit,
                        isStock: s.isStock,
                        stockConc: s.stockConc,
                        stockUnit: s.stockUnit
                    }))
                }
            ],
            isSaveRecipeOpen: false,
            activeRecipeName: name
        })),
    loadRecipe: (recipe) =>
        set({
            bufferVolume: recipe.totalVolume,
            bufferUnit: recipe.totalUnit,
            activeRecipeName: recipe.name,
            solutes: recipe.solutes.map((s) => ({
                ...s,
                id: Math.random().toString(36).substr(2, 9)
            }))
        }),
    deleteRecipe: (id) =>
        set((state) => ({
            savedRecipes: state.savedRecipes.filter((r) => r.id !== id)
        }))
});
