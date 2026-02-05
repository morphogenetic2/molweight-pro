import type { StateCreator } from "zustand";
import type { AppState, StocksSlice, AdjustmentStock } from "@/store/storeTypes";

export const DEFAULT_ADJUSTMENT_STOCKS: AdjustmentStock[] = [
    { id: "hcl_1m", name: "HCl 1M", concM: 1, type: "acid" },
    { id: "hcl_5m", name: "HCl 5M", concM: 5, type: "acid" },
    { id: "naoh_1m", name: "NaOH 1M", concM: 1, type: "base" },
    { id: "naoh_10m", name: "NaOH 10M", concM: 10, type: "base" }
];

export const createStocksSlice: StateCreator<AppState, [], [], StocksSlice> = (set) => ({
    stocks: [],
    addStock: (stock) => set((state) => ({ stocks: [...(state.stocks || []), stock] })),
    updateStock: (id, data) =>
        set((state) => ({
            stocks: (state.stocks || []).map((s) => (s.id === id ? { ...s, ...data } : s))
        })),
    removeStock: (id) =>
        set((state) => ({
            stocks: (state.stocks || []).filter((s) => s.id !== id)
        })),

    adjustmentStocks: DEFAULT_ADJUSTMENT_STOCKS,
    addAdjustmentStock: (stock) =>
        set((state) => ({
            adjustmentStocks: [...(state.adjustmentStocks || []), stock]
        })),
    updateAdjustmentStock: (id, data) =>
        set((state) => ({
            adjustmentStocks: (state.adjustmentStocks || []).map((s) => (s.id === id ? { ...s, ...data } : s))
        })),
    removeAdjustmentStock: (id) =>
        set((state) => ({
            adjustmentStocks: (state.adjustmentStocks || []).filter((s) => s.id !== id)
        }))
});
