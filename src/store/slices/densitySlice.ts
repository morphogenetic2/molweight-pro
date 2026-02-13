import type { StateCreator } from "zustand";
import type { AppState, DensitySlice, LiquidDensityEntry } from "@/store/storeTypes";

export const DEFAULT_LIQUID_DENSITIES: LiquidDensityEntry[] = [];

export const createDensitySlice: StateCreator<AppState, [], [], DensitySlice> = (set) => ({
    liquidDensities: DEFAULT_LIQUID_DENSITIES,
    upsertLiquidDensity: (entry) =>
        set((state) => {
            const normalized: LiquidDensityEntry = {
                cid: entry.cid,
                name: entry.name.trim(),
                density: entry.density,
            };

            const index = state.liquidDensities.findIndex((item) => item.cid === entry.cid);
            if (index === -1) {
                return {
                    liquidDensities: [...state.liquidDensities, normalized],
                };
            }

            return {
                liquidDensities: state.liquidDensities.map((item, itemIndex) =>
                    itemIndex === index ? normalized : item
                ),
            };
        }),
    removeLiquidDensity: (cid) =>
        set((state) => ({
            liquidDensities: state.liquidDensities.filter((entry) => entry.cid !== cid),
        })),
});
