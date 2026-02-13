/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SerialDilutionCalculator from "@/components/calculators/SerialDilutionCalculator";
import { useStore } from "@/store/useStore";
import { DEFAULT_SERIAL_DILUTION } from "@/store/slices/serialDilutionSlice";

function resetSerialState() {
    useStore.setState((state) => ({
        ...state,
        serialDilutionState: { ...DEFAULT_SERIAL_DILUTION },
    }));
}

describe("SerialDilutionCalculator", () => {
    beforeEach(() => {
        resetSerialState();
    });

    it("renders an auto-generated step plan from default valid inputs", () => {
        render(<SerialDilutionCalculator />);

        expect(screen.getByText("Step Plan")).toBeInTheDocument();
        expect(screen.getByText(/2 step\(s\)/)).toBeInTheDocument();
        expect(screen.getByText("Stock Needed")).toBeInTheDocument();
    });

    it("shows validation errors when auto ratio is invalid", () => {
        useStore.setState((state) => ({
            ...state,
            serialDilutionState: {
                ...DEFAULT_SERIAL_DILUTION,
                autoDilutionFactor: "not-a-ratio",
            },
        }));

        render(<SerialDilutionCalculator />);

        expect(
            screen.getByText("Auto dilution factor must be a valid dilution like 1:2, 1:10, or x4.")
        ).toBeInTheDocument();
    });

    it("renders custom step inputs when switching to custom mode", () => {
        render(<SerialDilutionCalculator />);

        fireEvent.click(screen.getByRole("button", { name: "Custom" }));

        expect(screen.getByText(/Custom Step Inputs/i)).toBeInTheDocument();
        expect(screen.getByText("Step 1")).toBeInTheDocument();
    });

    it("keeps start/stock unit unchanged when target unit is changed", () => {
        render(<SerialDilutionCalculator />);

        const selects = screen.getAllByRole("combobox");
        fireEvent.change(selects[2]!, { target: { value: "uM" } });

        const { serialDilutionState } = useStore.getState();
        expect(serialDilutionState.concentrationUnit).toBe("mM");
        expect(serialDilutionState.targetConcentrationUnit).toBe("uM");
    });

    it("shows a pre-dilution visual cue and explanatory note when stock is above start", () => {
        useStore.setState((state) => ({
            ...state,
            serialDilutionState: {
                ...DEFAULT_SERIAL_DILUTION,
                stockConcentration: "150",
                startConcentration: "100",
                targetConcentration: "40",
                autoDilutionFactor: "1:2",
            },
        }));

        render(<SerialDilutionCalculator />);

        expect(screen.getByText("PRE-DILUTION")).toBeInTheDocument();
        expect(
            screen.getByText(
                "Step 0 prepares Start from Stock (ratio = Stock/Start), independent of the auto dilution factor."
            )
        ).toBeInTheDocument();
    });

    it("counts only main serial steps and annotates PRE/BLANK extras", () => {
        useStore.setState((state) => ({
            ...state,
            serialDilutionState: {
                ...DEFAULT_SERIAL_DILUTION,
                stockConcentration: "150",
                startConcentration: "100",
                targetConcentration: "40",
                autoDilutionFactor: "1:2",
                includeBlank: true,
            },
        }));

        render(<SerialDilutionCalculator />);

        expect(screen.getByText("1 step(s) + PRE + BLANK")).toBeInTheDocument();
    });

    it("hides pre-dilution explanatory note when stock equals start", () => {
        useStore.setState((state) => ({
            ...state,
            serialDilutionState: {
                ...DEFAULT_SERIAL_DILUTION,
                stockConcentration: "100",
                startConcentration: "100",
            },
        }));

        render(<SerialDilutionCalculator />);

        expect(
            screen.queryByText(
                "Step 0 prepares Start from Stock (ratio = Stock/Start), independent of the auto dilution factor."
            )
        ).not.toBeInTheDocument();
    });

    it("formats small molar concentrations using a more readable unit", () => {
        useStore.setState((state) => ({
            ...state,
            serialDilutionState: {
                ...DEFAULT_SERIAL_DILUTION,
                mode: "auto",
                seriesType: "dilution",
                autoStopMode: "steps",
                stockConcentration: "0.0104",
                startConcentration: "0.0104",
                concentrationUnit: "mM",
                stepCount: 1,
                autoDilutionFactor: "1:2",
                includeBlank: false,
            },
        }));

        render(<SerialDilutionCalculator />);

        expect(screen.getAllByText(/5\.2 μM/).length).toBeGreaterThan(0);
    });
});
