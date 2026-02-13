/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MolarityCalculator from "@/components/calculators/MolarityCalculator";
import { useStore } from "@/store/useStore";
import { DEFAULT_MOLARITY } from "@/store/slices/molaritySlice";

function resetMolarityState() {
    useStore.setState((state) => ({
        ...state,
        molarityState: { ...DEFAULT_MOLARITY },
    }));
}

describe("MolarityCalculator", () => {
    beforeEach(() => {
        resetMolarityState();
    });

    it("solves MW when target is molecular weight and concentration is molar", async () => {
        useStore.setState((state) => ({
            ...state,
            molarityState: {
                ...DEFAULT_MOLARITY,
                target: "mw",
                mass: "58.44",
                massUnit: "g",
                volume: "1",
                volUnit: "L",
                concentration: "1",
                concUnit: "M",
                mw: 0,
            },
        }));

        render(<MolarityCalculator />);

        await waitFor(() => {
            expect(screen.getByTestId("molarity-mw-input")).toHaveValue(58.44);
        });
    });

    it("shows a warning when trying to solve MW with non-molar concentration units", () => {
        useStore.setState((state) => ({
            ...state,
            molarityState: {
                ...DEFAULT_MOLARITY,
                target: "mw",
                mass: "10",
                massUnit: "g",
                volume: "1",
                volUnit: "L",
                concentration: "10",
                concUnit: "g/L",
                mw: 0,
            },
        }));

        render(<MolarityCalculator />);

        expect(
            screen.getByText("MW solve requires a molar concentration unit (M, mM, μM, nM).")
        ).toBeInTheDocument();
    });

    it("lets users select MW as the target variable", async () => {
        resetMolarityState();
        const user = userEvent.setup();

        render(<MolarityCalculator />);

        await user.click(screen.getByTestId("molarity-target-mw"));

        expect(useStore.getState().molarityState.target).toBe("mw");
    });
});
