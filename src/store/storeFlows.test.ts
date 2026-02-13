/** @vitest-environment jsdom */

import { useStore } from "@/store/useStore";
import { useToastStore } from "@/store/useToastStore";
import { DEFAULT_ADJUSTMENT_STOCKS } from "@/store/slices/stocksSlice";
import { DEFAULT_BUFFER_UNIT, DEFAULT_BUFFER_VOLUME } from "@/store/slices/bufferRecipeSlice";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resetStores() {
    (useStore as typeof useStore & { persist?: { clearStorage?: () => void } }).persist?.clearStorage?.();

    const state = useStore.getState();
    state.resetStore();

    useStore.setState({
        history: [],
        savedRecipes: [],
        stocks: [],
        adjustmentStocks: DEFAULT_ADJUSTMENT_STOCKS,
        solutes: [],
        bufferVolume: DEFAULT_BUFFER_VOLUME,
        bufferUnit: DEFAULT_BUFFER_UNIT,
        activeRecipeName: null,
        isSaveRecipeOpen: false,
    });

    useToastStore.setState({ toasts: [] });
}

describe("store flows", () => {
    beforeEach(() => {
        resetStores();
    });

    it("uses UUIDs for solutes and saved recipes and regenerates solute IDs on recipe load", () => {
        const store = useStore.getState();

        store.addSolute({ name: "NaCl", mw: "58.44", conc: "1", unit: "M" });

        const createdSolutes = useStore.getState().solutes;
        expect(createdSolutes).toHaveLength(1);
        const originalSoluteId = createdSolutes[0].id;
        expect(originalSoluteId).toMatch(UUID_V4_REGEX);

        store.saveRecipe("Test Recipe", "UUID flow test");

        const saved = useStore.getState().savedRecipes;
        expect(saved).toHaveLength(1);
        expect(saved[0].id).toMatch(UUID_V4_REGEX);

        useStore.getState().clearSolutes();
        useStore.getState().loadRecipe(saved[0]);

        const loadedSolutes = useStore.getState().solutes;
        expect(loadedSolutes).toHaveLength(1);
        expect(loadedSolutes[0].id).toMatch(UUID_V4_REGEX);
        expect(loadedSolutes[0].id).not.toBe(originalSoluteId);
    });

    it("uses UUIDs for toast IDs", () => {
        useToastStore.getState().push("Saved", "success", 10000);

        const toasts = useToastStore.getState().toasts;
        expect(toasts).toHaveLength(1);
        expect(toasts[0].id).toMatch(UUID_V4_REGEX);
    });
});
