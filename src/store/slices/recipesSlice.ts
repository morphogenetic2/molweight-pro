import type { StateCreator } from "zustand";
import type { AppState, RecipesSlice } from "@/store/storeTypes";
import { createId } from "@/lib/id";

export const createRecipesSlice: StateCreator<AppState, [], [], RecipesSlice> = (set) => ({
    savedRecipes: [],
    saveRecipe: (name, description) =>
        set((state) => ({
            savedRecipes: [
                ...state.savedRecipes,
                {
                    id: createId(),
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
                id: createId()
            }))
        }),
    deleteRecipe: (id) =>
        set((state) => ({
            savedRecipes: state.savedRecipes.filter((r) => r.id !== id)
        }))
});
