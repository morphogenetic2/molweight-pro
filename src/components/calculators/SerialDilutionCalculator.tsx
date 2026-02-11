"use client";

import { useMemo } from "react";
import { AlertCircle, ArrowRightLeft, Copy, Download, ListChecks } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useToastStore } from "@/store/useToastStore";
import { ValueUnitInput } from "@/components/ui/ValueUnitInput";
import { MASS_CONC_UNITS, MOLAR_UNITS, PERCENT_UNITS, VOLUME_UNITS, convertUnitValue } from "@/lib/chemistry/units";
import type { SerialDilutionMode } from "@/store/storeTypes";

interface SerialStep {
    step: number;
    ratio: string;
    factor: number;
    fromConcentration: number;
    toConcentration: number;
    transferVolume: number;
    diluentVolume: number;
    theoreticalTransferVolume: number;
    theoreticalDiluentVolume: number;
    cumulativeFactor: number;
    adjustedForPipette: boolean;
    belowMinPipette: boolean;
}

interface PlanResult {
    errors: string[];
    steps: SerialStep[];
    totalDiluent: number;
    stockNeeded: number;
    finalConcentration: number | null;
    targetReached: boolean;
    targetExact: boolean;
    target: number | null;
}

const CONC_OPTS = [
    ...Object.keys(MOLAR_UNITS),
    ...Object.keys(MASS_CONC_UNITS),
    ...Object.keys(PERCENT_UNITS),
];

const VOL_OPTS = Object.keys(VOLUME_UNITS);

function parsePositiveNumber(raw: string): number | null {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function formatNumber(value: number, digits = 6): string {
    if (!Number.isFinite(value)) return "-";
    if (value === 0) return "0";
    if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e6) {
        return value.toExponential(3);
    }
    return Number.parseFloat(value.toPrecision(digits)).toString();
}

function parseDilutionFactor(raw: string): number | null {
    const token = raw.trim().toLowerCase().replace(/\s+/g, "");
    if (!token) return null;

    const simpleMatch = token.match(/^x?(\d*\.?\d+)$/);
    if (simpleMatch) {
        const factor = Number.parseFloat(simpleMatch[1]);
        return factor > 1 ? factor : null;
    }

    const oneToNMatch = token.match(/^1[:/](\d*\.?\d+)$/);
    if (oneToNMatch) {
        const factor = Number.parseFloat(oneToNMatch[1]);
        return factor > 1 ? factor : null;
    }

    const ratioMatch = token.match(/^(\d*\.?\d+)[:/](\d*\.?\d+)$/);
    if (!ratioMatch) return null;

    const left = Number.parseFloat(ratioMatch[1]);
    const right = Number.parseFloat(ratioMatch[2]);
    if (left <= 0 || right <= 0 || right <= left) return null;

    const factor = right / left;
    return factor > 1 ? factor : null;
}

function quantizeTransferToPipette(
    transferVolume: number,
    volumeUnit: string,
    minPipetteVolumeUl: number,
    finalVolume: number
): { transferVolume: number; diluentVolume: number; adjustedForPipette: boolean; belowMinPipette: boolean } {
    if (transferVolume <= 0) {
        return {
            transferVolume: 0,
            diluentVolume: Math.max(finalVolume, 0),
            adjustedForPipette: false,
            belowMinPipette: false,
        };
    }

    const transferUl = convertUnitValue(transferVolume, volumeUnit, "uL");
    if (transferUl === null || !Number.isFinite(transferUl)) {
        return {
            transferVolume,
            diluentVolume: Math.max(finalVolume - transferVolume, 0),
            adjustedForPipette: false,
            belowMinPipette: false,
        };
    }

    const belowMinPipette = transferUl < minPipetteVolumeUl;
    const roundedTransferUl = Math.max(
        minPipetteVolumeUl,
        Math.round(transferUl / minPipetteVolumeUl) * minPipetteVolumeUl
    );
    const roundedTransfer = convertUnitValue(roundedTransferUl, "uL", volumeUnit) ?? transferVolume;
    const clampedTransfer = Math.min(roundedTransfer, finalVolume);

    return {
        transferVolume: clampedTransfer,
        diluentVolume: Math.max(finalVolume - clampedTransfer, 0),
        adjustedForPipette: Math.abs(clampedTransfer - transferVolume) > 1e-12,
        belowMinPipette,
    };
}

function ratioLabel(factor: number): string {
    const rounded = Math.round(factor);
    if (Math.abs(factor - rounded) < 1e-9) {
        return `1:${rounded}`;
    }
    return `1:${formatNumber(factor, 4)}`;
}

function formatVolumeWithAutoUl(value: number, unit: string): string {
    const inMl = convertUnitValue(value, unit, "mL");
    if (inMl !== null && inMl > 0 && inMl < 1) {
        const inUl = convertUnitValue(value, unit, "uL");
        if (inUl !== null && Number.isFinite(inUl)) {
            return `${formatNumber(inUl)} μL`;
        }
    }
    return `${formatNumber(value)} ${unit}`;
}

function escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function buildProtocolText(params: {
    mode: SerialDilutionMode;
    steps: SerialStep[];
    startConcentration: string;
    concentrationUnit: string;
    volumeUnit: string;
    targetConcentration: string;
    autoRatio: string;
    exactLastStep: boolean;
    minPipetteVolumeUl: number;
}): string {
    const {
        mode,
        steps,
        startConcentration,
        concentrationUnit,
        volumeUnit,
        targetConcentration,
        autoRatio,
        exactLastStep,
        minPipetteVolumeUl,
    } = params;

    const lines = [
        "Serial Dilution Protocol",
        `Mode: ${mode === "auto" ? "Auto" : "Custom"}`,
        `Start concentration: ${startConcentration} ${concentrationUnit}`,
        `Final volume per step: ${steps.length > 0 ? formatVolumeWithAutoUl(steps[0].transferVolume + steps[0].diluentVolume, volumeUnit) : "-"}`,
        `Minimum pipettable volume: ${formatNumber(minPipetteVolumeUl)} μL`,
    ];

    if (mode === "auto") {
        lines.push(`Target concentration: ${targetConcentration} ${concentrationUnit}`);
        lines.push(`Base step ratio: ${autoRatio}`);
        lines.push(`Exact last step: ${exactLastStep ? "yes" : "no"}`);
    }

    lines.push("", "Steps:");
    lines.push(
        ...steps.map((row) =>
            `Step ${row.step}: Mix ${formatVolumeWithAutoUl(row.transferVolume, volumeUnit)} previous solution + ${formatVolumeWithAutoUl(row.diluentVolume, volumeUnit)} diluent (${row.ratio}) -> ${formatNumber(row.toConcentration)} ${concentrationUnit}`
        )
    );

    return lines.join("\n");
}

function buildProtocolCsv(steps: SerialStep[], concentrationUnit: string, volumeUnit: string): string {
    const header = [
        "Step",
        "Ratio",
        `From (${concentrationUnit})`,
        `To (${concentrationUnit})`,
        "Transfer Volume",
        "Diluent Volume",
        "Cumulative Dilution",
    ];

    const rows = steps.map((row) => [
        String(row.step),
        row.ratio,
        formatNumber(row.fromConcentration),
        formatNumber(row.toConcentration),
        formatVolumeWithAutoUl(row.transferVolume, volumeUnit),
        formatVolumeWithAutoUl(row.diluentVolume, volumeUnit),
        `1:${formatNumber(row.cumulativeFactor, 5)}`,
    ]);

    return [header, ...rows]
        .map((line) => line.map((item) => escapeCsv(item)).join(","))
        .join("\n");
}

export default function SerialDilutionCalculator() {
    const { serialDilutionState, setSerialDilutionState } = useStore();
    const { push } = useToastStore();
    const {
        mode,
        startConcentration,
        targetConcentration,
        concentrationUnit,
        finalVolume,
        volumeUnit,
        autoRatio,
        customRatios,
        exactLastStep,
        minPipetteVolumeUl,
    } = serialDilutionState;

    const plan = useMemo<PlanResult>(() => {
        const errors: string[] = [];

        const start = parsePositiveNumber(startConcentration);
        if (!start) {
            errors.push("Start concentration must be a number greater than zero.");
        }

        const volume = parsePositiveNumber(finalVolume);
        if (!volume) {
            errors.push("Final volume per step must be a number greater than zero.");
        }

        let factors: number[] = [];
        let target: number | null = null;

        if (mode === "auto") {
            target = parsePositiveNumber(targetConcentration);
            if (!target) {
                errors.push("Target concentration must be a number greater than zero.");
            }

            const factor = parseDilutionFactor(autoRatio);
            if (!factor) {
                errors.push("Auto ratio must be a valid dilution like 1:2, 1:10, or x4.");
            }

            if (start && target && start <= target) {
                errors.push("Target concentration must be lower than start concentration.");
            }

            if (start && target && factor && start > target) {
                const stepCount = Math.ceil(Math.log(start / target) / Math.log(factor));
                if (!Number.isFinite(stepCount) || stepCount <= 0) {
                    errors.push("Could not generate steps from these values.");
                } else if (stepCount > 200) {
                    errors.push("Plan would exceed 200 steps. Increase ratio or raise target concentration.");
                } else if (exactLastStep) {
                    const prefixFactors = Array.from({ length: Math.max(stepCount - 1, 0) }, () => factor);
                    const concentrationBeforeLast = prefixFactors.reduce((conc, current) => conc / current, start);
                    const lastFactor = concentrationBeforeLast / target;

                    if (!Number.isFinite(lastFactor) || lastFactor <= 1) {
                        errors.push("Could not compute an exact last step with these values.");
                    } else {
                        factors = [...prefixFactors, lastFactor];
                    }
                } else {
                    factors = Array.from({ length: stepCount }, () => factor);
                }
            }
        } else {
            const tokens = customRatios
                .split(/[,;\n]+/)
                .map((token) => token.trim())
                .filter(Boolean);

            if (tokens.length === 0) {
                errors.push("Add at least one ratio in custom mode (example: 1:2, 1:4, 1:2).");
            } else {
                const parsed = tokens.map((token) => ({ token, factor: parseDilutionFactor(token) }));
                const invalid = parsed.filter((entry) => !entry.factor).map((entry) => entry.token);
                if (invalid.length > 0) {
                    errors.push(`Invalid ratio(s): ${invalid.join(", ")}.`);
                } else {
                    factors = parsed.map((entry) => entry.factor as number);
                }
            }
        }

        if (errors.length > 0 || !start || !volume) {
            return {
                errors,
                steps: [],
                totalDiluent: 0,
                stockNeeded: 0,
                finalConcentration: null,
                targetReached: false,
                targetExact: false,
                target,
            };
        }

        const reduced = factors.reduce(
            (acc, factor, index) => {
                const fromConcentration = acc.currentConcentration;
                const toConcentration = fromConcentration / factor;
                const theoreticalTransferVolume = volume / factor;
                const theoreticalDiluentVolume = volume - theoreticalTransferVolume;
                const practical = quantizeTransferToPipette(
                    theoreticalTransferVolume,
                    volumeUnit,
                    minPipetteVolumeUl,
                    volume
                );
                const cumulativeFactor = acc.currentCumulative * factor;
                const row: SerialStep = {
                    step: index + 1,
                    ratio: ratioLabel(factor),
                    factor,
                    fromConcentration,
                    toConcentration,
                    transferVolume: practical.transferVolume,
                    diluentVolume: practical.diluentVolume,
                    theoreticalTransferVolume,
                    theoreticalDiluentVolume,
                    cumulativeFactor,
                    adjustedForPipette: practical.adjustedForPipette,
                    belowMinPipette: practical.belowMinPipette,
                };
                return {
                    steps: acc.steps.concat(row),
                    currentConcentration: toConcentration,
                    currentCumulative: cumulativeFactor,
                };
            },
            {
                steps: [] as SerialStep[],
                currentConcentration: start,
                currentCumulative: 1,
            }
        );

        const steps = reduced.steps;
        const totalDiluent = steps.reduce((sum, row) => sum + row.diluentVolume, 0);
        const stockNeeded = steps[0]?.transferVolume ?? 0;
        const finalConcentration = steps[steps.length - 1]?.toConcentration ?? start;
        const tolerance = target ? Math.max(target * 1e-9, 1e-12) : 0;
        const targetReached = target ? finalConcentration <= target + tolerance : false;
        const targetExact = target ? Math.abs(finalConcentration - target) <= tolerance : false;

        return {
            errors,
            steps,
            totalDiluent,
            stockNeeded,
            finalConcentration,
            targetReached,
            targetExact,
            target,
        };
    }, [mode, startConcentration, targetConcentration, finalVolume, autoRatio, customRatios, exactLastStep, volumeUnit, minPipetteVolumeUl]);

    const pipetteAdjustedSteps = plan.steps.filter((step) => step.adjustedForPipette).length;
    const belowMinSteps = plan.steps.filter((step) => step.belowMinPipette).length;

    const protocolText = useMemo(
        () =>
            buildProtocolText({
                mode,
                steps: plan.steps,
                startConcentration,
                concentrationUnit,
                volumeUnit,
                targetConcentration,
                autoRatio,
                exactLastStep,
                minPipetteVolumeUl,
            }),
        [mode, plan.steps, startConcentration, concentrationUnit, volumeUnit, targetConcentration, autoRatio, exactLastStep, minPipetteVolumeUl]
    );

    const protocolCsv = useMemo(
        () => buildProtocolCsv(plan.steps, concentrationUnit, volumeUnit),
        [plan.steps, concentrationUnit, volumeUnit]
    );

    const handleCopyProtocol = async () => {
        if (plan.steps.length === 0) {
            push("No protocol to copy yet.", "info");
            return;
        }

        try {
            await navigator.clipboard.writeText(protocolText);
            push("Protocol copied to clipboard.", "success");
        } catch {
            push("Could not copy protocol.", "error");
        }
    };

    const handleExportCsv = () => {
        if (plan.steps.length === 0) {
            push("No steps to export yet.", "info");
            return;
        }

        const blob = new Blob([protocolCsv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        link.href = url;
        link.download = `serial-dilution-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        push("CSV exported.", "success");
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                    Serial Dilution Planner
                </h2>
                <p className="text-xs text-zinc-500">
                    Build either an automatic dilution series or a custom ratio sequence (for example <span className="font-mono text-zinc-400">1:2, 1:4, 1:2</span>).
                </p>
            </div>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                    <button
                        onClick={() => setSerialDilutionState({ mode: "auto" })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            mode === "auto" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                        Auto
                    </button>
                    <button
                        onClick={() => setSerialDilutionState({ mode: "custom" })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            mode === "custom" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                        Custom
                    </button>
                </div>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <ValueUnitInput
                        label="Start Concentration"
                        value={startConcentration}
                        unit={concentrationUnit}
                        onValueChange={(value) => setSerialDilutionState({ startConcentration: value })}
                        onUnitChange={(unit) => setSerialDilutionState({ concentrationUnit: unit })}
                        options={CONC_OPTS}
                        placeholder="100"
                    />

                    <ValueUnitInput
                        label={mode === "auto" ? "Target Concentration" : "Reference Concentration"}
                        value={targetConcentration}
                        unit={concentrationUnit}
                        onValueChange={(value) => setSerialDilutionState({ targetConcentration: value })}
                        onUnitChange={(unit) => setSerialDilutionState({ concentrationUnit: unit })}
                        options={CONC_OPTS}
                        placeholder={mode === "auto" ? "1" : "Optional in custom mode"}
                        disabled={mode !== "auto"}
                    />

                    <ValueUnitInput
                        label="Final Volume Per Step"
                        value={finalVolume}
                        unit={volumeUnit}
                        onValueChange={(value) => setSerialDilutionState({ finalVolume: value })}
                        onUnitChange={(unit) => setSerialDilutionState({ volumeUnit: unit })}
                        options={VOL_OPTS}
                        placeholder="1"
                    />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Minimum Pipettable Volume</label>
                        <select
                            value={String(minPipetteVolumeUl)}
                            onChange={(e) => setSerialDilutionState({ minPipetteVolumeUl: Number.parseFloat(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                        >
                            <option value="0.001" className="bg-zinc-900">0.001 μL (P2.5)</option>
                            <option value="0.01" className="bg-zinc-900">0.01 μL (P10)</option>
                            <option value="0.02" className="bg-zinc-900">0.02 μL (P20)</option>
                            <option value="0.2" className="bg-zinc-900">0.2 μL (P200)</option>
                            <option value="1" className="bg-zinc-900">1 μL (P1000)</option>
                        </select>
                        <p className="text-[11px] text-zinc-500">Step transfer volumes are rounded to this practical pipetting resolution.</p>
                    </div>

                    {mode === "auto" ? (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Step Ratio</label>
                            <input
                                value={autoRatio}
                                onChange={(e) => setSerialDilutionState({ autoRatio: e.target.value })}
                                placeholder="1:10"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                            />
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
                                <input
                                    type="checkbox"
                                    checked={exactLastStep}
                                    onChange={(e) => setSerialDilutionState({ exactLastStep: e.target.checked })}
                                    className="h-3.5 w-3.5 rounded border-white/20 bg-white/5"
                                />
                                Adjust the last step to hit target concentration exactly.
                            </label>
                            <p className="text-[11px] text-zinc-500">Accepted ratio formats: <span className="font-mono">1:10</span>, <span className="font-mono">x4</span>, <span className="font-mono">4</span>.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Custom Ratio Sequence</label>
                            <textarea
                                value={customRatios}
                                onChange={(e) => setSerialDilutionState({ customRatios: e.target.value })}
                                rows={3}
                                placeholder="1:2, 1:4, 1:2"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40 resize-none"
                            />
                            <p className="text-[11px] text-zinc-500">Separate steps by comma, semicolon, or new line.</p>
                        </div>
                    )}
                </div>

                {plan.errors.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            {plan.errors.map((error) => (
                                <p key={error}>{error}</p>
                            ))}
                        </div>
                    </div>
                )}
                {plan.steps.length > 0 && (pipetteAdjustedSteps > 0 || belowMinSteps > 0) && (
                    <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>
                            Rounded {pipetteAdjustedSteps} step(s) to the selected pipetting resolution ({formatNumber(minPipetteVolumeUl)} μL).
                            {belowMinSteps > 0 ? ` ${belowMinSteps} step(s) were below the minimum and clamped.` : ""}
                        </p>
                    </div>
                )}
            </section>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-200 flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-indigo-400" />
                        Step Plan
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">{plan.steps.length} step(s)</span>
                        <button
                            onClick={handleCopyProtocol}
                            disabled={plan.steps.length === 0}
                            className="secondary px-2.5 py-1.5 text-[11px] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </button>
                        <button
                            onClick={handleExportCsv}
                            disabled={plan.steps.length === 0}
                            className="secondary px-2.5 py-1.5 text-[11px] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="h-3.5 w-3.5" />
                            CSV
                        </button>
                    </div>
                </div>

                {plan.steps.length === 0 ? (
                    <div className="text-sm text-zinc-500 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                        Add valid inputs to generate a dilution series.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full min-w-[780px] text-sm">
                                <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left px-3 py-2">Step</th>
                                        <th className="text-left px-3 py-2">Ratio</th>
                                        <th className="text-left px-3 py-2">From</th>
                                        <th className="text-left px-3 py-2">To</th>
                                        <th className="text-left px-3 py-2">Transfer</th>
                                        <th className="text-left px-3 py-2">Diluent</th>
                                        <th className="text-left px-3 py-2">Cumulative</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plan.steps.map((row) => (
                                        <tr key={row.step} className="border-t border-white/5 text-zinc-300">
                                            <td className="px-3 py-2 font-mono">{row.step}</td>
                                            <td className="px-3 py-2 font-mono text-indigo-400">{row.ratio}</td>
                                            <td className="px-3 py-2 font-mono">{formatNumber(row.fromConcentration)} {concentrationUnit}</td>
                                            <td className="px-3 py-2 font-mono">{formatNumber(row.toConcentration)} {concentrationUnit}</td>
                                            <td className="px-3 py-2 font-mono">
                                                {formatVolumeWithAutoUl(row.transferVolume, volumeUnit)}
                                                {row.adjustedForPipette && (
                                                    <span className="ml-1 text-[10px] text-zinc-500">
                                                        (raw {formatVolumeWithAutoUl(row.theoreticalTransferVolume, volumeUnit)})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {formatVolumeWithAutoUl(row.diluentVolume, volumeUnit)}
                                                {row.adjustedForPipette && (
                                                    <span className="ml-1 text-[10px] text-zinc-500">
                                                        (raw {formatVolumeWithAutoUl(row.theoreticalDiluentVolume, volumeUnit)})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono">1:{formatNumber(row.cumulativeFactor, 5)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Stock Needed</p>
                                <p className="mt-1 text-base font-mono text-white">{formatVolumeWithAutoUl(plan.stockNeeded, volumeUnit)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total Diluent</p>
                                <p className="mt-1 text-base font-mono text-white">{formatVolumeWithAutoUl(plan.totalDiluent, volumeUnit)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Final Concentration</p>
                                <p className="mt-1 text-base font-mono text-white">{formatNumber(plan.finalConcentration ?? 0)} {concentrationUnit}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Target Check</p>
                                <p className={`mt-1 text-base font-mono ${mode === "auto" && plan.targetReached ? "text-emerald-400" : "text-zinc-300"}`}>
                                    {mode === "auto"
                                        ? plan.targetExact
                                            ? "Exact"
                                            : plan.targetReached
                                                ? "Reached"
                                                : `>${formatNumber(plan.target ?? 0)} ${concentrationUnit}`
                                        : "Custom"}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className="glass-card p-4 sm:p-5 text-xs text-zinc-500 flex items-start gap-3">
                <ArrowRightLeft className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <p>
                    This planner assumes each step is prepared from the previous step at the same final volume. If you want plate layouts, branching trees, or replicates, we can add that next.
                </p>
            </section>
        </div>
    );
}
