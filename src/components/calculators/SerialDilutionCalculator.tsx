"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Copy, Download, ListChecks, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useStore } from "@/store/useStore";
import { useToastStore } from "@/store/useToastStore";
import { ValueUnitInput } from "@/components/ui/ValueUnitInput";
import {
    MASS_CONC_UNITS,
    MOLAR_UNITS,
    PERCENT_UNITS,
    VOLUME_UNITS,
    convertUnitValue,
    getUnitLabel,
    getUnitType,
    parseValueWithUnit,
} from "@/lib/chemistry/units";
import {
    buildSerialPlan,
    normalizeCustomDilutionToken,
    resizeCustomStepInputs,
} from "@/lib/serialDilution/planner";
import type {
    SerialAutoStopMode,
    SerialDilutionMode,
    SerialSeriesType,
} from "@/store/storeTypes";

const CONC_OPTS = [
    ...Object.keys(MOLAR_UNITS),
    ...Object.keys(MASS_CONC_UNITS),
    ...Object.keys(PERCENT_UNITS),
];

const VOL_OPTS = Object.keys(VOLUME_UNITS);
const BLANK_STEP_TOKENS = new Set(["0", "b", "blank"]);

function formatNumber(value: number, digits = 6): string {
    if (!Number.isFinite(value)) return "-";
    if (value === 0) return "0";
    if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e6) {
        return value.toExponential(3);
    }
    return Number.parseFloat(value.toPrecision(digits)).toString();
}

function formatPipetteVolumeInUl(valueUl: number): string {
    if (!Number.isFinite(valueUl) || valueUl <= 0) return "0 μL";
    if (valueUl < 0.001) return "<0.001 μL";
    if (valueUl <= 2.5) return `${valueUl.toFixed(3)} μL`;
    if (valueUl <= 10) return `${valueUl.toFixed(2)} μL`;
    if (valueUl <= 200) {
        const rounded = Math.round(valueUl / 0.02) * 0.02;
        return `${rounded.toFixed(2)} μL`;
    }
    if (valueUl <= 1000) return `${Math.round(valueUl)} μL`;
    const inMl = valueUl / 1000;
    return `${Number.parseFloat(inMl.toFixed(3))} mL`;
}

function formatVolume(value: number, unit: string): string {
    const valueUl = convertUnitValue(value, unit, "uL");
    if (valueUl !== null && Number.isFinite(valueUl)) {
        return formatPipetteVolumeInUl(valueUl);
    }
    return `${formatNumber(value)} ${unit}`;
}

function pickReadableMolarUnit(value: number, unit: string): { value: number; unit: string } {
    const normalizedUnit = unit === "μM" ? "uM" : unit;
    const molarUnits = ["M", "mM", "uM", "nM"] as const;
    if (!molarUnits.includes(normalizedUnit as (typeof molarUnits)[number])) {
        return { value, unit };
    }

    const converted = molarUnits
        .map((candidate) => ({
            unit: candidate,
            value: convertUnitValue(value, unit, candidate),
        }))
        .filter((entry): entry is { unit: (typeof molarUnits)[number]; value: number } =>
            entry.value !== null && Number.isFinite(entry.value) && entry.value > 0
        );

    const inPreferredRange = converted.find((entry) => entry.value >= 1 && entry.value < 1000);
    if (inPreferredRange) {
        return inPreferredRange;
    }

    if (converted.length === 0) {
        return { value, unit };
    }

    const maxValue = converted.reduce((best, entry) =>
        entry.value > best.value ? entry : best
    );
    const minValue = converted.reduce((best, entry) =>
        entry.value < best.value ? entry : best
    );

    if (maxValue.value < 1) {
        return maxValue;
    }
    if (minValue.value >= 1000) {
        return minValue;
    }

    return { value, unit: normalizedUnit };
}

function formatConcentration(value: number | null, unit: string): string {
    if (value === null || !Number.isFinite(value)) return "-";
    if (getUnitType(unit) !== "molar") {
        return `${formatNumber(value)} ${getUnitLabel(unit)}`;
    }

    const scaled = pickReadableMolarUnit(value, unit);
    return `${formatNumber(scaled.value)} ${getUnitLabel(scaled.unit)}`;
}

function escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

type SerialPlanStep = ReturnType<typeof buildSerialPlan>["steps"][number];

function buildStepInstruction(
    row: SerialPlanStep,
    volumeUnit: string,
    concentrationUnit: string,
    dispenseVolumePerDestination?: number | null
): string {
    const transferText = formatVolume(row.transferVolume, volumeUnit);
    const diluentText = formatVolume(row.diluentVolume, volumeUnit);
    const dispenseText =
        typeof dispenseVolumePerDestination === "number" &&
        Number.isFinite(dispenseVolumePerDestination) &&
        dispenseVolumePerDestination > 0
            ? formatVolume(dispenseVolumePerDestination, volumeUnit)
            : null;

    if (row.isBlank) {
        if (dispenseText) {
            return `Add ${diluentText} of diluent only (no transfer from previous solution), then dispense ${dispenseText} per blank destination well/tube.`;
        }
        return `Add ${diluentText} of diluent only to the blank well/tube. Do not transfer from the previous solution.`;
    }

    if (row.isPreparation) {
        const toConcentration = formatConcentration(row.toConcentration ?? 0, concentrationUnit);
        if (dispenseText) {
            return `Take ${transferText} from stock, add ${diluentText} of diluent, mix thoroughly, then use this as the start solution (${toConcentration}); dispense ${dispenseText} per Step 1 destination and keep the remaining volume for downstream transfer.`;
        }
        return `Take ${transferText} from stock, add ${diluentText} of diluent, mix thoroughly, then use this as the start solution (${toConcentration}) for dispensing and downstream serial transfer.`;
    }

    const toConcentration = formatConcentration(row.toConcentration ?? 0, concentrationUnit);
    if (dispenseText) {
        return `Pipette ${transferText} from the previous solution, add ${diluentText} of diluent, mix thoroughly, then dispense ${dispenseText} per Step ${row.stepLabel} destination (${toConcentration}) and keep the remaining volume for the next transfer if needed.`;
    }
    return `Pipette ${transferText} from the previous solution, add ${diluentText} of diluent, mix thoroughly, then use this to dispense step ${row.stepLabel} wells/tubes (${toConcentration}).`;
}

function normalizeCustomConcentrationToken(raw: string, defaultUnit: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (BLANK_STEP_TOKENS.has(trimmed.toLowerCase())) return "BLANK";

    const parsed = parseValueWithUnit(trimmed, CONC_OPTS);
    const numeric = Number.parseFloat(parsed.value);
    if (!Number.isFinite(numeric)) return trimmed;

    const unit = parsed.unit ?? defaultUnit;
    return `${formatNumber(numeric)} ${getUnitLabel(unit)}`;
}

function buildProtocolText(params: {
    mode: SerialDilutionMode;
    seriesType: SerialSeriesType;
    autoStopMode: SerialAutoStopMode;
    stockConcentration: string;
    startConcentration: string;
    targetConcentration: string;
    targetConcentrationUnit: string;
    concentrationUnit: string;
    finalVolume: string;
    volumeUnit: string;
    replicates: number;
    overagePercent: number;
    includeBlank: boolean;
    stepCount: number;
    autoDilutionFactor: string;
    autoConcentrationStep: string;
    preparedVolumePerStep: number | null;
    steps: ReturnType<typeof buildSerialPlan>["steps"];
}): string {
    const {
        mode,
        seriesType,
        autoStopMode,
        stockConcentration,
        startConcentration,
        targetConcentration,
        targetConcentrationUnit,
        concentrationUnit,
        finalVolume,
        volumeUnit,
        replicates,
        overagePercent,
        includeBlank,
        stepCount,
        autoDilutionFactor,
        autoConcentrationStep,
        preparedVolumePerStep,
        steps,
    } = params;
    const parsedDispenseVolume = Number.parseFloat(finalVolume);
    const dispenseVolumePerDestination =
        Number.isFinite(parsedDispenseVolume) && parsedDispenseVolume > 0
            ? parsedDispenseVolume
            : null;

    const lines = [
        "Serial Dilution Protocol",
        `Mode: ${mode === "auto" ? "Auto" : "Custom"}`,
        `Input type: ${seriesType === "dilution" ? "Dilutions" : "Concentrations"}`,
        `Stock concentration: ${stockConcentration} ${concentrationUnit}`,
        `Start concentration: ${startConcentration} ${concentrationUnit}`,
        `Final volume per sample: ${finalVolume} ${volumeUnit}`,
        `Replicates: ${replicates}`,
        `Overage: ${overagePercent}% (one-replicate safety margin)`,
        `Include blank: ${includeBlank ? "yes" : "no"}`,
        `Dispense volume per destination: ${dispenseVolumePerDestination ? formatVolume(dispenseVolumePerDestination, volumeUnit) : "-"}`,
        `Prepared total per dilution step: ${preparedVolumePerStep ? formatVolume(preparedVolumePerStep, volumeUnit) : "-"}`,
        "Transfer + diluent rows already include extra carry-over volume for downstream steps.",
    ];

    if (mode === "auto") {
        lines.push(`Auto stop mode: ${autoStopMode === "target" ? "Final concentration" : "Step count"}`);
        if (autoStopMode === "target") {
            lines.push(`Target concentration: ${targetConcentration} ${targetConcentrationUnit}`);
        } else {
            lines.push(`Step count: ${stepCount}`);
        }
        if (seriesType === "dilution") {
            lines.push(`Auto dilution factor: ${autoDilutionFactor}`);
        } else {
            lines.push(`Concentration decrement: ${autoConcentrationStep} ${concentrationUnit}`);
        }
    } else {
        lines.push(`Step count: ${stepCount}`);
    }

    lines.push("", "Steps:");
    lines.push(
        ...steps.map((row) => {
            if (row.isBlank) {
                return `Blank: ${buildStepInstruction(row, volumeUnit, concentrationUnit, dispenseVolumePerDestination)}`;
            }
            const stepTitle = row.isPreparation ? "Step 0 (PRE-DILUTION)" : `Step ${row.stepLabel}`;
            return `${stepTitle}: ${buildStepInstruction(row, volumeUnit, concentrationUnit, dispenseVolumePerDestination)}`;
        })
    );

    return lines.join("\n");
}

function buildProtocolCsv(
    steps: ReturnType<typeof buildSerialPlan>["steps"],
    concentrationUnit: string,
    volumeUnit: string
): string {
    const header = [
        "Step",
        "Dilution",
        `From (${concentrationUnit})`,
        `To (${concentrationUnit})`,
        "Transfer",
        "Diluent",
        "Cumulative",
    ];

    const rows = steps.map((row) => [
        row.isPreparation ? "0 (PRE-DILUTION)" : row.stepLabel,
        row.isPreparation ? `PRE-DILUTION ${row.ratio}` : row.ratio,
        row.fromConcentration === null ? "-" : formatNumber(row.fromConcentration),
        row.isBlank ? "BLANK" : formatNumber(row.toConcentration ?? 0),
        formatVolume(row.transferVolume, volumeUnit),
        formatVolume(row.diluentVolume, volumeUnit),
        row.cumulativeFactor === null ? "-" : `1:${formatNumber(row.cumulativeFactor, 5)}`,
    ]);

    return [header, ...rows]
        .map((line) => line.map((item) => escapeCsv(item)).join(","))
        .join("\n");
}

function sanitizePdfText(raw: string): string {
    return raw.replace(/μ/g, "u");
}

export default function SerialDilutionCalculator() {
    const { serialDilutionState, setSerialDilutionState } = useStore();
    const { push } = useToastStore();
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [instructionsExportName, setInstructionsExportName] = useState("");

    const safeMode: SerialDilutionMode = serialDilutionState.mode === "custom" ? "custom" : "auto";
    const safeSeriesType: SerialSeriesType =
        serialDilutionState.seriesType === "concentration" ? "concentration" : "dilution";
    const safeAutoStopMode: SerialAutoStopMode =
        serialDilutionState.autoStopMode === "steps" ? "steps" : "target";
    const safeReplicates =
        Number.isInteger(serialDilutionState.replicates) && serialDilutionState.replicates >= 1
            ? serialDilutionState.replicates
            : 1;
    const safeOveragePercent = [0, 5, 10, 20].includes(serialDilutionState.overagePercent)
        ? serialDilutionState.overagePercent
        : 0;
    const safeStepCount =
        Number.isInteger(serialDilutionState.stepCount) &&
        serialDilutionState.stepCount >= 1 &&
        serialDilutionState.stepCount <= 200
            ? serialDilutionState.stepCount
            : 1;
    const safeCustomStepInputs = useMemo(
        () => resizeCustomStepInputs(serialDilutionState.customStepInputs ?? [], safeStepCount),
        [serialDilutionState.customStepInputs, safeStepCount]
    );

    const plan = useMemo(
        () =>
            buildSerialPlan({
                mode: safeMode,
                seriesType: safeSeriesType,
                autoStopMode: safeAutoStopMode,
                stockConcentration: serialDilutionState.stockConcentration,
                startConcentration: serialDilutionState.startConcentration,
                targetConcentration: serialDilutionState.targetConcentration,
                targetConcentrationUnit: serialDilutionState.targetConcentrationUnit,
                concentrationUnit: serialDilutionState.concentrationUnit,
                finalVolume: serialDilutionState.finalVolume,
                volumeUnit: serialDilutionState.volumeUnit,
                replicates: safeReplicates,
                overagePercent: safeOveragePercent,
                includeBlank: Boolean(serialDilutionState.includeBlank),
                stepCount: safeStepCount,
                autoDilutionFactor: serialDilutionState.autoDilutionFactor,
                autoConcentrationStep: serialDilutionState.autoConcentrationStep,
                customStepInputs: safeCustomStepInputs,
            }),
        [
            safeMode,
            safeSeriesType,
            safeAutoStopMode,
            serialDilutionState.stockConcentration,
            serialDilutionState.startConcentration,
            serialDilutionState.targetConcentration,
            serialDilutionState.targetConcentrationUnit,
            serialDilutionState.concentrationUnit,
            serialDilutionState.finalVolume,
            serialDilutionState.volumeUnit,
            safeReplicates,
            safeOveragePercent,
            serialDilutionState.includeBlank,
            safeStepCount,
            serialDilutionState.autoDilutionFactor,
            serialDilutionState.autoConcentrationStep,
            safeCustomStepInputs,
        ]
    );

    const protocolText = useMemo(
        () =>
            buildProtocolText({
                mode: safeMode,
                seriesType: safeSeriesType,
                autoStopMode: safeAutoStopMode,
                stockConcentration: serialDilutionState.stockConcentration,
                startConcentration: serialDilutionState.startConcentration,
                targetConcentration: serialDilutionState.targetConcentration,
                targetConcentrationUnit: serialDilutionState.targetConcentrationUnit,
                concentrationUnit: serialDilutionState.concentrationUnit,
                finalVolume: serialDilutionState.finalVolume,
                volumeUnit: serialDilutionState.volumeUnit,
                replicates: safeReplicates,
                overagePercent: safeOveragePercent,
                includeBlank: Boolean(serialDilutionState.includeBlank),
                stepCount: safeStepCount,
                autoDilutionFactor: serialDilutionState.autoDilutionFactor,
                autoConcentrationStep: serialDilutionState.autoConcentrationStep,
                preparedVolumePerStep: plan.preparedVolumePerStep,
                steps: plan.steps,
            }),
        [
            safeMode,
            safeSeriesType,
            safeAutoStopMode,
            serialDilutionState.stockConcentration,
            serialDilutionState.startConcentration,
            serialDilutionState.targetConcentration,
            serialDilutionState.targetConcentrationUnit,
            serialDilutionState.concentrationUnit,
            serialDilutionState.finalVolume,
            serialDilutionState.volumeUnit,
            safeReplicates,
            safeOveragePercent,
            serialDilutionState.includeBlank,
            safeStepCount,
            serialDilutionState.autoDilutionFactor,
            serialDilutionState.autoConcentrationStep,
            plan.preparedVolumePerStep,
            plan.steps,
        ]
    );

    const protocolCsv = useMemo(
        () => buildProtocolCsv(plan.steps, serialDilutionState.concentrationUnit, serialDilutionState.volumeUnit),
        [plan.steps, serialDilutionState.concentrationUnit, serialDilutionState.volumeUnit]
    );
    const hasPreparation = useMemo(() => plan.steps.some((row) => row.isPreparation), [plan.steps]);
    const hasBlank = useMemo(() => plan.steps.some((row) => row.isBlank), [plan.steps]);
    const mainStepCount = useMemo(
        () => plan.steps.filter((row) => !row.isPreparation && !row.isBlank).length,
        [plan.steps]
    );

    const targetStatus = useMemo(() => {
        if (safeMode !== "auto") return "Custom";
        if (safeAutoStopMode !== "target") return "Step-count";
        const targetInTargetUnit = plan.target === null
            ? null
            : convertUnitValue(
                plan.target,
                serialDilutionState.concentrationUnit,
                serialDilutionState.targetConcentrationUnit
            );
        const targetValue = targetInTargetUnit ?? plan.target;
        const targetUnit = targetInTargetUnit === null
            ? serialDilutionState.concentrationUnit
            : serialDilutionState.targetConcentrationUnit;
        if (plan.targetExact) return "Exact";
        if (plan.targetAbove && targetValue !== null) {
            return `Closest > ${formatNumber(targetValue)} ${targetUnit}`;
        }
        if (targetValue !== null) {
            return `Reached ${formatNumber(targetValue)} ${targetUnit}`;
        }
        return "-";
    }, [
        safeMode,
        safeAutoStopMode,
        plan.targetExact,
        plan.targetAbove,
        plan.target,
        serialDilutionState.concentrationUnit,
        serialDilutionState.targetConcentrationUnit,
    ]);

    const updateStepCount = (nextRaw: string) => {
        const parsed = Number.parseInt(nextRaw, 10);
        const bounded = Number.isFinite(parsed) ? Math.max(1, Math.min(200, parsed)) : 1;
        setSerialDilutionState({
            stepCount: bounded,
            customStepInputs: resizeCustomStepInputs(safeCustomStepInputs, bounded),
        });
    };

    const updateReplicates = (nextRaw: string) => {
        const parsed = Number.parseInt(nextRaw, 10);
        const bounded = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
        setSerialDilutionState({ replicates: bounded });
    };

    const updateCustomInput = (index: number, nextValue: string) => {
        const nextInputs = [...safeCustomStepInputs];
        nextInputs[index] = nextValue;
        setSerialDilutionState({ customStepInputs: nextInputs });
    };

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

    const handlePrintInstructions = (manualName?: string) => {
        if (plan.steps.length === 0) {
            push("No instructions to print yet.", "info");
            return;
        }

        try {
            const doc = new jsPDF();
            const parsedDispenseVolume = Number.parseFloat(serialDilutionState.finalVolume);
            const dispenseVolumePerDestination =
                Number.isFinite(parsedDispenseVolume) && parsedDispenseVolume > 0
                    ? parsedDispenseVolume
                    : null;
            const timestamp = new Date();
            const generatedAt = `${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`;
            const reportTitle = (manualName ?? "").trim() || "Serial Dilution Instructions";

            doc.setFontSize(20);
            doc.setTextColor(40);
            doc.text(sanitizePdfText(reportTitle), 14, 18);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${generatedAt}`, 14, 24);

            doc.setFontSize(11);
            doc.setTextColor(55);
            const summaryLines = [
                `Mode: ${safeMode === "auto" ? "Auto" : "Custom"}`,
                `Input type: ${safeSeriesType === "dilution" ? "Dilutions" : "Concentrations"}`,
                `Stock: ${serialDilutionState.stockConcentration} ${serialDilutionState.concentrationUnit}`,
                `Start: ${serialDilutionState.startConcentration} ${serialDilutionState.concentrationUnit}`,
                safeAutoStopMode === "target"
                    ? `Target: ${serialDilutionState.targetConcentration} ${serialDilutionState.targetConcentrationUnit}`
                    : `Step count: ${safeStepCount}`,
                `Volume per step: ${serialDilutionState.finalVolume} ${serialDilutionState.volumeUnit}`,
                `Replicates: ${safeReplicates} | Overage: ${safeOveragePercent}%`,
                `Blank row: ${serialDilutionState.includeBlank ? "Included" : "Not included"}`,
            ].map(sanitizePdfText);

            let y = 32;
            for (const line of summaryLines) {
                doc.text(line, 14, y);
                y += 5;
            }

            const instructionLines = [
                "General instructions:",
                "1. Label tubes/containers according to the Step column.",
                "2. Add diluent first, then add transfer volume from the previous solution.",
                "3. Mix thoroughly after each step before moving to the next one.",
                "4. Use calibrated pipettes matching the reported volumes.",
                "5. Transfer + diluent per row already includes enough volume to dispense and seed the next dilution.",
            ].map(sanitizePdfText);

            y += 2;
            for (const line of instructionLines) {
                doc.text(line, 14, y);
                y += 5;
            }

            const tableRows = plan.steps.map((row) => {
                const stepLabel = row.isPreparation ? "0 (PRE-DILUTION)" : row.stepLabel;
                const stepDisplay = row.isBlank ? "Blank" : `Step ${stepLabel}`;
                const instruction = buildStepInstruction(
                    row,
                    serialDilutionState.volumeUnit,
                    serialDilutionState.concentrationUnit,
                    dispenseVolumePerDestination
                );
                const toDisplay = row.isBlank
                    ? "BLANK"
                    : formatConcentration(row.toConcentration ?? 0, serialDilutionState.concentrationUnit);
                const cumulative = row.cumulativeFactor === null ? "-" : `1:${formatNumber(row.cumulativeFactor, 5)}`;

                return [
                    sanitizePdfText(stepDisplay),
                    sanitizePdfText(instruction),
                    sanitizePdfText(toDisplay),
                    sanitizePdfText(cumulative),
                ];
            });

            autoTable(doc, {
                startY: y + 2,
                head: [["Step", "Instruction", "Result", "Cumulative"]],
                body: tableRows,
                styles: {
                    fontSize: 9,
                    cellPadding: 2.5,
                },
                columnStyles: {
                    1: { cellWidth: 105 },
                },
                headStyles: {
                    fillColor: [44, 62, 80],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                },
                alternateRowStyles: {
                    fillColor: [247, 250, 252],
                },
                margin: { left: 14, right: 14 },
                theme: "grid",
            });

            const footerY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 50;
            doc.setFontSize(9);
            doc.setTextColor(110);
            doc.text(
                sanitizePdfText("Tip: PRE-DILUTION (Step 0) is independent from the repeated dilution factor."),
                14,
                footerY + 8
            );

            doc.autoPrint();
            const blobUrl = doc.output("bloburl");
            const printWindow = window.open(blobUrl, "_blank");
            if (!printWindow) {
                const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
                const fileBase = reportTitle
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                    || "serial-dilution-instructions";
                doc.save(`${fileBase}-${stamp}.pdf`);
            }

            push("Print-ready instructions generated.", "success");
        } catch {
            push("Could not generate printable instructions.", "error");
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                    Serial Dilution Planner
                </h2>
                <p className="text-xs text-zinc-500">
                    Build serial workflows with either dilution factors or direct concentration targets.
                </p>
            </div>

            <section className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                        <button
                            onClick={() => setSerialDilutionState({ mode: "auto" })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                safeMode === "auto"
                                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Auto
                        </button>
                        <button
                            onClick={() =>
                                setSerialDilutionState({
                                    mode: "custom",
                                    customStepInputs: resizeCustomStepInputs(safeCustomStepInputs, safeStepCount),
                                })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                safeMode === "custom"
                                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Custom
                        </button>
                    </div>

                    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                        <button
                            onClick={() => setSerialDilutionState({ seriesType: "dilution" })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                safeSeriesType === "dilution"
                                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Dilutions
                        </button>
                        <button
                            onClick={() => setSerialDilutionState({ seriesType: "concentration" })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                safeSeriesType === "concentration"
                                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Concentrations
                        </button>
                    </div>

                    {safeMode === "auto" && (
                        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                            <button
                                onClick={() => setSerialDilutionState({ autoStopMode: "target" })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    safeAutoStopMode === "target"
                                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                                        : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                Final Conc
                            </button>
                            <button
                                onClick={() => setSerialDilutionState({ autoStopMode: "steps" })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    safeAutoStopMode === "steps"
                                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                                        : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                Steps
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <ValueUnitInput
                        label="Stock Concentration"
                        value={serialDilutionState.stockConcentration}
                        unit={serialDilutionState.concentrationUnit}
                        onValueChange={(value) => setSerialDilutionState({ stockConcentration: value })}
                        onUnitChange={(unit) => setSerialDilutionState({ concentrationUnit: unit })}
                        options={CONC_OPTS}
                        placeholder="100"
                    />

                    <ValueUnitInput
                        label="Start Concentration"
                        value={serialDilutionState.startConcentration}
                        unit={serialDilutionState.concentrationUnit}
                        onValueChange={(value) => setSerialDilutionState({ startConcentration: value })}
                        onUnitChange={(unit) => setSerialDilutionState({ concentrationUnit: unit })}
                        options={CONC_OPTS}
                        placeholder="100"
                    />

                    {safeMode === "auto" && safeAutoStopMode === "target" && (
                        <ValueUnitInput
                            label="Final Concentration Target"
                            value={serialDilutionState.targetConcentration}
                            unit={serialDilutionState.targetConcentrationUnit}
                            onValueChange={(value) => setSerialDilutionState({ targetConcentration: value })}
                            onUnitChange={(unit) => setSerialDilutionState({ targetConcentrationUnit: unit })}
                            options={CONC_OPTS}
                            placeholder="1"
                        />
                    )}

                    <ValueUnitInput
                        label="Volume Per Step"
                        value={serialDilutionState.finalVolume}
                        unit={serialDilutionState.volumeUnit}
                        onValueChange={(value) => setSerialDilutionState({ finalVolume: value })}
                        onUnitChange={(unit) => setSerialDilutionState({ volumeUnit: unit })}
                        options={VOL_OPTS}
                        placeholder="1"
                    />

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-zinc-500 uppercase">Replicates & Overage</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-end">
                            <div className="space-y-1">
                                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider">Replicates</label>
                                <div className="inline-flex h-12 items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                                    <button
                                        type="button"
                                        aria-label="Decrease replicates"
                                        onClick={() => updateReplicates(String(safeReplicates - 1))}
                                        className="px-2.5 py-1.5 rounded-lg text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={safeReplicates}
                                        onChange={(e) => updateReplicates(e.target.value)}
                                        className="w-[6ch] h-full text-center bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40"
                                    />
                                    <button
                                        type="button"
                                        aria-label="Increase replicates"
                                        onClick={() => updateReplicates(String(safeReplicates + 1))}
                                        className="px-2.5 py-1.5 rounded-lg text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider">Overage</label>
                                <select
                                    value={String(safeOveragePercent)}
                                    onChange={(e) =>
                                        setSerialDilutionState({
                                            overagePercent: Number.parseInt(e.target.value, 10) || 0,
                                        })
                                    }
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40"
                                >
                                    <option value="0" className="bg-zinc-900">0%</option>
                                    <option value="5" className="bg-zinc-900">5%</option>
                                    <option value="10" className="bg-zinc-900">10%</option>
                                    <option value="20" className="bg-zinc-900">20%</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                            Prepared total/step = per-sample volume × (replicates + overage of one replicate).
                        </p>
                    </div>

                    <div className="space-y-2 self-start">
                        <div className="flex items-center justify-between gap-2">
                            <label className="block text-xs font-bold text-zinc-500 uppercase">Blank Step</label>
                            <span
                                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                                    serialDilutionState.includeBlank
                                        ? "text-cyan-200 border-cyan-400/40 bg-cyan-500/20"
                                        : "text-zinc-400 border-white/10 bg-white/5"
                                }`}
                            >
                                Blank: {serialDilutionState.includeBlank ? "On" : "Off"}
                            </span>
                        </div>
                        <div
                            className="inline-flex h-12 items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10"
                            role="group"
                            aria-label="Blank step toggle"
                        >
                            <button
                                type="button"
                                aria-pressed={!serialDilutionState.includeBlank}
                                onClick={() => setSerialDilutionState({ includeBlank: false })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    !serialDilutionState.includeBlank
                                        ? "bg-zinc-600 text-white shadow-lg shadow-zinc-500/20"
                                        : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                No Blank
                            </button>
                            <button
                                type="button"
                                aria-pressed={serialDilutionState.includeBlank}
                                onClick={() => setSerialDilutionState({ includeBlank: true })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    serialDilutionState.includeBlank
                                        ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                                        : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                Add Blank
                            </button>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                            {serialDilutionState.includeBlank
                                ? "A final BLANK row will be added using full prepared diluent volume."
                                : "No BLANK row will be added to the final plan."}
                        </p>
                    </div>

                    {safeMode === "auto" && safeSeriesType === "dilution" && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Auto Dilution Factor</label>
                            <input
                                value={serialDilutionState.autoDilutionFactor}
                                onChange={(e) => setSerialDilutionState({ autoDilutionFactor: e.target.value })}
                                placeholder="1:10"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                            />
                            <p className="text-[11px] text-zinc-500">
                                Accepted formats: <span className="font-mono">1:10</span>, <span className="font-mono">x4</span>, <span className="font-mono">4</span>.
                            </p>
                        </div>
                    )}

                    {safeMode === "auto" && safeSeriesType === "concentration" && (
                        <ValueUnitInput
                            label="Concentration Step"
                            value={serialDilutionState.autoConcentrationStep}
                            unit={serialDilutionState.concentrationUnit}
                            onValueChange={(value) => setSerialDilutionState({ autoConcentrationStep: value })}
                            onUnitChange={(unit) => setSerialDilutionState({ concentrationUnit: unit })}
                            options={CONC_OPTS}
                            placeholder="10"
                        />
                    )}

                    {(safeMode === "custom" || safeAutoStopMode === "steps") && (
                        <div className="space-y-2 self-start">
                            <label className="block text-xs font-bold text-zinc-500 uppercase">Number of Steps</label>
                            <div className="inline-flex h-12 items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                                <button
                                    type="button"
                                    aria-label="Decrease steps"
                                    onClick={() => updateStepCount(String(safeStepCount - 1))}
                                    className="px-2.5 py-1.5 rounded-lg text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min={1}
                                    max={200}
                                    step={1}
                                    value={safeStepCount}
                                    onChange={(e) => updateStepCount(e.target.value)}
                                    className="w-[6ch] h-full text-center bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40"
                                />
                                <button
                                    type="button"
                                    aria-label="Increase steps"
                                    onClick={() => updateStepCount(String(safeStepCount + 1))}
                                    className="px-2.5 py-1.5 rounded-lg text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {safeMode === "custom" && (
                    <div className="space-y-3 border border-white/10 rounded-xl p-3 sm:p-4 bg-white/5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">
                                Custom Step Inputs ({safeSeriesType === "dilution" ? "Dilutions" : "Concentrations"})
                            </label>
                            <span className="text-[11px] text-zinc-500">{safeStepCount} step(s)</span>
                        </div>
                        <div className="space-y-2">
                            {safeCustomStepInputs.map((value, index) => (
                                <div key={`custom-step-${index + 1}`} className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-zinc-300 min-w-[4.5rem]">
                                        Step {index + 1}
                                    </label>
                                    <input
                                        value={value}
                                        onChange={(e) => updateCustomInput(index, e.target.value)}
                                        onBlur={(e) => {
                                            if (safeSeriesType === "dilution") {
                                                updateCustomInput(index, normalizeCustomDilutionToken(e.target.value));
                                                return;
                                            }
                                            updateCustomInput(
                                                index,
                                                normalizeCustomConcentrationToken(
                                                    e.target.value,
                                                    serialDilutionState.concentrationUnit
                                                )
                                            );
                                        }}
                                        className="w-[12ch] max-w-[12ch] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/40"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {plan.errors.length > 0 && (
                    <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg space-y-1">
                        {plan.errors.map((error) => (
                            <p key={error}>{error}</p>
                        ))}
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
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                            {mainStepCount} step(s)
                            {hasPreparation ? " + PRE" : ""}
                            {hasBlank ? " + BLANK" : ""}
                        </span>
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
                        <button
                            onClick={() => setIsPrintModalOpen(true)}
                            disabled={plan.steps.length === 0}
                            className="secondary px-2.5 py-1.5 text-[11px] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print Instructions
                        </button>
                    </div>
                </div>

                {plan.steps.length === 0 ? (
                    <div className="text-sm text-zinc-500 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                        Add valid inputs to generate a serial plan.
                    </div>
                ) : (
                    <>
                        {hasPreparation && (
                            <div className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-400/25 p-3 rounded-lg">
                                Step 0 prepares Start from Stock (ratio = Stock/Start), independent of the auto dilution factor.
                            </div>
                        )}
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full min-w-[780px] text-sm">
                                <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left px-3 py-2">Step</th>
                                        <th className="text-left px-3 py-2">Dilution</th>
                                        <th className="text-left px-3 py-2">From</th>
                                        <th className="text-left px-3 py-2">To</th>
                                        <th className="text-left px-3 py-2">Transfer</th>
                                        <th className="text-left px-3 py-2">Diluent</th>
                                        <th className="text-left px-3 py-2">Cumulative</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plan.steps.map((row) => (
                                        <tr
                                            key={row.key}
                                            className={`border-t ${
                                                row.isPreparation
                                                    ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
                                                    : "border-white/5 text-zinc-300"
                                            }`}
                                        >
                                            <td className="px-3 py-2 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span>{row.stepLabel}</span>
                                                    {row.isPreparation && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-cyan-300/40 bg-cyan-500/20 text-cyan-100 uppercase tracking-wide">
                                                            PRE-DILUTION
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2 font-mono ${row.isPreparation ? "text-cyan-200" : "text-indigo-400"}`}>
                                                {row.ratio}
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {row.fromConcentration === null
                                                    ? "-"
                                                    : formatConcentration(row.fromConcentration, serialDilutionState.concentrationUnit)}
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {row.isBlank
                                                    ? "BLANK"
                                                    : formatConcentration(row.toConcentration ?? 0, serialDilutionState.concentrationUnit)}
                                            </td>
                                            <td className="px-3 py-2 font-mono">{formatVolume(row.transferVolume, serialDilutionState.volumeUnit)}</td>
                                            <td className="px-3 py-2 font-mono">{formatVolume(row.diluentVolume, serialDilutionState.volumeUnit)}</td>
                                            <td className="px-3 py-2 font-mono">
                                                {row.cumulativeFactor === null ? "-" : `1:${formatNumber(row.cumulativeFactor, 5)}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Stock Needed</p>
                                <p className="mt-1 text-base font-mono text-white">
                                    {formatVolume(plan.stockNeeded, serialDilutionState.volumeUnit)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total Diluent</p>
                                <p className="mt-1 text-base font-mono text-white">
                                    {formatVolume(plan.totalDiluent, serialDilutionState.volumeUnit)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Prepared Total / Step</p>
                                <p className="mt-1 text-base font-mono text-white">
                                    {formatVolume(plan.preparedVolumePerStep ?? 0, serialDilutionState.volumeUnit)}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-1">{plan.aliquotCount} replicate(s)</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Final Concentration</p>
                                <p className="mt-1 text-base font-mono text-white">
                                    {formatConcentration(plan.finalConcentration ?? 0, serialDilutionState.concentrationUnit)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Target Check</p>
                                <p className="mt-1 text-base font-mono text-zinc-300">{targetStatus}</p>
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className="glass-card p-4 sm:p-5 text-xs text-zinc-500 flex items-start gap-3">
                <ArrowRightLeft className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <p>
                    This planner assumes each dilution step is prepared from the previous concentration at a constant
                    final volume. Custom mode lets you define every step directly.
                </p>
            </section>

            {isPrintModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsPrintModalOpen(false)}
                    />
                    <div className="relative glass-card !p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                                <Printer className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Print Instructions</h3>
                                <p className="text-zinc-400 text-sm">Enter a title for the print-ready PDF (optional)</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Document Title</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={instructionsExportName}
                                    onChange={(e) => setInstructionsExportName(e.target.value)}
                                    placeholder="Serial Dilution Instructions"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handlePrintInstructions(instructionsExportName);
                                            setIsPrintModalOpen(false);
                                        }
                                    }}
                                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-3 outline-none transition-all text-white placeholder:text-white/30"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setIsPrintModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        handlePrintInstructions(instructionsExportName);
                                        setIsPrintModalOpen(false);
                                    }}
                                    className="flex-1 px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all text-sm font-bold shadow-lg shadow-indigo-500/20"
                                >
                                    Print PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
