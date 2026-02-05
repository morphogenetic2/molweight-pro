import { describe, it, expect } from "vitest";
import { normalize, denormalize, toMolarity, toMassConcentration, Solver } from "@/lib/chemistry/converter";


describe("converter", () => {
    it("normalizes and denormalizes units", () => {
        expect(normalize(1, "mL")).toBeCloseTo(0.001, 6);
        expect(denormalize(0.001, "mL")).toBeCloseTo(1, 6);
        expect(normalize(1, "mg/mL")).toBeCloseTo(1, 6); // g/L base
    });

    it("converts to molarity", () => {
        expect(toMolarity(1, "M", 58.44)).toBeCloseTo(1, 6);
        expect(toMolarity(58.44, "g/L", 58.44)).toBeCloseTo(1, 6);
        const molFromPercent = toMolarity(1, "pct", 58.44);
        expect(molFromPercent).toBeCloseTo(10 / 58.44, 5);
    });

    it("converts to mass concentration", () => {
        expect(toMassConcentration(1, "M", 58.44)).toBeCloseTo(58.44, 6);
        expect(toMassConcentration(1, "pct", 58.44)).toBeCloseTo(10, 6);
    });

    it("solver computes mass, volume, concentration", () => {
        const mass = Solver.solveMass(1, "M", 1, "L", 58.44);
        expect(mass).toBeCloseTo(58.44, 5);

        const vol = Solver.solveVolume(58.44, "g", 1, "M", 58.44);
        expect(vol).toBeCloseTo(1, 5);

        const conc = Solver.solveConcentration(58.44, "g", 1, "L", "M", 58.44);
        expect(conc).toBeCloseTo(1, 5);
    });
});
