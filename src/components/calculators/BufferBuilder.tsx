"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { Solute, LiquidDensityEntry } from "@/store/storeTypes";
import { Trash2, Plus, Search, Loader2, Book, Save, Square, CheckSquare, Beaker, Printer } from "lucide-react";
import { FormulaBadge } from "../ui/FormulaBadge";
import { formatMass, formatVolume, formatConcentration, getUnitLabel, tryCalculateMw } from "@/lib/parser";
import { convertUnitValue, parseValueWithUnit } from "@/lib/chemistry/units";
import { lookupDensityForCompound } from "@/lib/chemistry/density";
import { lookupPubChem } from "@/lib/api";
import { useDebounce } from "@/lib/hooks/useDebounce";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToastStore } from "@/store/useToastStore";

function bufferVolumeToLiters(bufferVolume: string, bufferUnit: string): number | null {
    const vol = Number.parseFloat(bufferVolume);
    if (!Number.isFinite(vol) || vol <= 0) return null;
    if (bufferUnit === "mL") return vol / 1000;
    if (bufferUnit === "μL") return vol / 1000000;
    return vol;
}

function computeMassRequiredInGrams(solute: Solute, bufferVolume: string, bufferUnit: string): number | null {
    if (solute.isStock && solute.stockConc) {
        return null;
    }

    const conc = Number.parseFloat(String(solute.conc));
    const volL = bufferVolumeToLiters(bufferVolume, bufferUnit);
    if (!Number.isFinite(conc) || !volL) return null;

    const mw = Number.parseFloat(String(solute.mw));
    if (solute.unit === "M") return Number.isFinite(mw) ? conc * volL * mw : null;
    if (solute.unit === "mM") return Number.isFinite(mw) ? (conc / 1000) * volL * mw : null;
    if (solute.unit === "μM") return Number.isFinite(mw) ? (conc / 1000000) * volL * mw : null;
    if (solute.unit === "pct") return (conc / 100) * (volL * 1000);

    const volML = volL * 1000;
    if (solute.unit === "μg/mL" || solute.unit === "ng/μL") return (conc / 1000) * volML / 1000;
    if (solute.unit === "mg/mL") return conc * volML / 1000;
    if (solute.unit === "mg/L") return conc * volL / 1000;
    if (solute.unit === "g/L") return conc * volL;

    return null;
}

function computeEquivalentLiquidVolume(
    solute: Solute,
    bufferVolume: string,
    bufferUnit: string,
    liquidDensities: LiquidDensityEntry[]
): string | null {
    const massGrams = computeMassRequiredInGrams(solute, bufferVolume, bufferUnit);
    const densityGPerMl = lookupDensityForCompound(
        {
            cid: solute.cid,
            name: solute.name,
            formula: solute.formula,
        },
        liquidDensities
    );
    if (!Number.isFinite(massGrams) || !densityGPerMl || massGrams === null || massGrams <= 0) {
        return null;
    }
    const volumeMl = massGrams / densityGPerMl;
    if (!Number.isFinite(volumeMl) || volumeMl <= 0) {
        return null;
    }
    return formatVolume(volumeMl / 1000);
}
function SoluteRow({ solute, isChecklist, onToggleCheck, view = 'table' }: { solute: Solute; isChecklist: boolean; onToggleCheck: (id: string) => void; view?: 'table' | 'card' }) {
    const { bufferVolume, bufferUnit, removeSolute, updateSolute, liquidDensities } = useStore();
    const [isSearching, setIsSearching] = useState(false);

    const debouncedName = useDebounce(solute.name, 600);

    useEffect(() => {
        const triggerLookup = async () => {
            const query = debouncedName.trim();
            if (!query) return;

            if (solute.formula === query) return;

            // 1. Try local advanced parser first
            const localResult = tryCalculateMw(query);
            if (localResult) {
                const nextData: Partial<Solute> = {
                    mw: localResult.mw.toString(),
                    formula: localResult.formula
                };
                updateSolute(solute.id, nextData);
                return;
            }

            // 2. Fallback to PubChem
            setIsSearching(true);
            try {
                const res = await lookupPubChem(query);
                if (res) {
                    const nextData: Partial<Solute> = {
                        mw: res.mw ? String(res.mw.toFixed(2)) : "",
                        formula: res.formula ? String(res.formula) : "",
                        cid: res.cid ? Number(res.cid) : undefined
                    };
                    updateSolute(solute.id, nextData);
                }
            } catch (err) {
                console.error("Lookup error:", err);
            } finally {
                setIsSearching(false);
            }
        };

        triggerLookup();
    }, [debouncedName, solute.id, solute.formula, updateSolute]);

    const calculateMass = () => {
        const mw = parseFloat(String(solute.mw));
        const conc = parseFloat(String(solute.conc));
        const vol = parseFloat(bufferVolume);

        if (isNaN(conc) || isNaN(vol)) return "-";

        let volL = vol;
        if (bufferUnit === "mL") volL = vol / 1000;
        if (bufferUnit === "μL") volL = vol / 1000000;

        if (solute.isStock && solute.stockConc) {
            const c1 = parseFloat(solute.stockConc);
            const u1 = solute.stockUnit || "";
            const c2 = conc;
            const u2 = solute.unit;

            if (isNaN(c1) || isNaN(c2)) return "-";

            const isMolar = (u: string) => ['M', 'mM', 'μM'].includes(u);
            const isMass = (u: string) => ['μg/mL', 'mg/mL', 'mg/L', 'g/L', 'pct', 'ng/μL'].includes(u);

            const domain1 = isMolar(u1) ? 'molar' : (isMass(u1) ? 'mass' : null);
            const domain2 = isMolar(u2) ? 'molar' : (isMass(u2) ? 'mass' : null);

            const normalizeToBase = (val: number, u: string) => {
                if (u === 'M' || u === 'g/L' || u === 'mg/mL') return val;
                if (u === 'mM' || u === 'mg/L' || u === 'μg/mL' || u === 'ng/μL') return val / 1000;
                if (u === 'μM') return val / 1e6;
                if (u === 'pct') return val * 10;
                return val;
            };

            let c1Base = normalizeToBase(c1, u1);
            const c2Base = normalizeToBase(c2, u2);

            if (domain1 !== domain2 && domain1 && domain2) {
                if (isNaN(mw) || mw <= 0) return "Mw?";
                if (domain2 === 'molar' && domain1 === 'mass') {
                    c1Base = c1Base / mw;
                } else if (domain2 === 'mass' && domain1 === 'molar') {
                    c1Base = c1Base * mw;
                }
            }

            if (c2Base > c1Base) {
                return (
                    <span className="text-red-400 text-xs font-bold leading-tight block">
                        Check final<br />concentration
                    </span>
                );
            }

            const v1L = (c2Base * volL) / c1Base;
            if (!isFinite(v1L) || v1L <= 0) return "-";
            return formatVolume(v1L);
        }

        if (solute.unit === "M" || solute.unit === "mM" || solute.unit === "μM") {
            if (isNaN(mw)) return "-";
            if (solute.unit === "M") return formatMass(conc * volL * mw);
            if (solute.unit === "mM") return formatMass((conc / 1000) * volL * mw);
            if (solute.unit === "μM") return formatMass((conc / 1000000) * volL * mw);
        }

        if (solute.unit === "pct") return formatMass((conc / 100) * (volL * 1000));
        if (solute.unit === "dil") return formatVolume(volL / conc);

        const volML = volL * 1000;
        if (solute.unit === "μg/mL" || solute.unit === "ng/μL") return formatMass((conc / 1000) * volML / 1000);
        if (solute.unit === "mg/mL") return formatMass(conc * volML / 1000);
        if (solute.unit === "mg/L") return formatMass(conc * volL / 1000);
        if (solute.unit === "g/L") return formatMass(conc * volL);

        return "-";
    };

    const handleExternalLookup = () => {
        const query = solute.name.trim();
        if (!query) return;
        const url = solute.cid
            ? `https://pubchem.ncbi.nlm.nih.gov/compound/${solute.cid}`
            : `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(query)}`;
        window.open(url, "_blank");
    };

    const handleUnitSelectChange = (nextUnit: string) => {
        const concNum = parseFloat(String(solute.conc));
        const mw = parseFloat(String(solute.mw));
        const converted = Number.isFinite(concNum)
            ? convertUnitValue(concNum, solute.unit, nextUnit, Number.isFinite(mw) ? mw : undefined)
            : null;

        if (converted === null) {
            updateSolute(solute.id, { unit: nextUnit });
            return;
        }

        const normalized = parseFloat(converted.toPrecision(8));
        updateSolute(solute.id, { conc: normalized.toString(), unit: nextUnit });
    };

    const equivalentLiquidVolume = computeEquivalentLiquidVolume(
        solute,
        bufferVolume,
        bufferUnit,
        liquidDensities
    );
    const amountOutput = calculateMass();
    const amountWithVolume =
        typeof amountOutput === "string" && equivalentLiquidVolume
            ? `${amountOutput} / ${equivalentLiquidVolume}`
            : amountOutput;

    if (view === 'table') {
        return (
            <tr className="hidden sm:table-row group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 align-top">
                    <div className="flex items-start gap-3">
                        {isChecklist && (
                            <button
                                onClick={() => onToggleCheck(solute.id)}
                                className="mt-1 shrink-0 text-zinc-500 hover:text-emerald-400 transition-colors"
                            >
                                {solute.done ? <CheckSquare className="h-5 w-5 text-emerald-500" /> : <Square className="h-5 w-5" />}
                            </button>
                        )}
                        <div className="flex flex-col gap-1 flex-1">
                            <div className="relative flex items-center gap-2">
                                <button
                                    onClick={handleExternalLookup}
                                    title="View on PubChem"
                                    aria-label="View on PubChem"
                                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-xs"
                                >
                                    <Search className="h-3.5 w-3.5" />
                                </button>
                                <div className="relative flex-1 flex items-center gap-2">
                                    {solute.isStock && (
                                        <>
                                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                                Stock
                                            </span>
                                            {solute.stockConc && (
                                                <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold tracking-wider text-indigo-400">
                                                    {formatConcentration(solute.stockConc, solute.stockUnit || "")} {getUnitLabel(solute.stockUnit || "")}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {isChecklist ? (
                                        <span className="flex-1 py-0.5 font-bold text-zinc-300 text-sm">{solute.name}</span>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="Name/Formula"
                                            value={solute.name}
                                            onChange={(e) => updateSolute(solute.id, { name: e.target.value })}
                                            className="flex-1 bg-transparent border-transparent p-0 focus:ring-0 focus:border-indigo-500/50 text-sm"
                                        />
                                    )}
                                    {isSearching && (
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {solute.formula && (
                                <div className="pl-9">
                                    <FormulaBadge formula={solute.formula} className="self-start text-[10px] px-2 py-0.5" />
                                </div>
                            )}
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 align-top">
                    <div className="space-y-2">
                        {isChecklist ? (
                            <div className="text-sm text-zinc-300">
                                <div>{solute.mw || "-"}</div>
                            </div>
                        ) : (
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={solute.mw}
                                disabled={solute.isStock}
                                onChange={(e) => updateSolute(solute.id, { mw: e.target.value })}
                                onBlur={(e) => {
                                    const raw = e.target.value;
                                    const parsed = parseValueWithUnit(raw, ["g/mol", "g", "mg", "kg"]);
                                    if (parsed.value !== "" && Number.isFinite(parseFloat(parsed.value))) {
                                        updateSolute(solute.id, { mw: parsed.value });
                                    } else {
                                        updateSolute(solute.id, { mw: raw.trim() });
                                    }
                                }}
                                className={`w-24 bg-transparent border-transparent p-0 focus:ring-0 text-sm ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-2">
                        {isChecklist ? (
                            <span className="text-sm font-bold text-zinc-300">
                                {formatConcentration(solute.conc, solute.unit)} {getUnitLabel(solute.unit)}
                            </span>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={solute.conc}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed = parseValueWithUnit(raw, ["M", "mM", "μM", "μg/mL", "ng/μL", "mg/mL", "mg/L", "g/L", "pct", "dil"]);
                                        updateSolute(solute.id, { conc: raw });
                                        if (parsed.unit) updateSolute(solute.id, { unit: parsed.unit });
                                    }}
                                    onBlur={(e) => {
                                        const raw = e.target.value;
                                        const parsed = parseValueWithUnit(raw, ["M", "mM", "μM", "μg/mL", "ng/μL", "mg/mL", "mg/L", "g/L", "pct", "dil"]);
                                        if (parsed.unit) updateSolute(solute.id, { unit: parsed.unit });
                                        if (parsed.value !== "" && Number.isFinite(parseFloat(parsed.value))) {
                                            updateSolute(solute.id, { conc: parsed.value });
                                        } else {
                                            updateSolute(solute.id, { conc: raw.trim() });
                                        }
                                    }}
                                    className="w-20 bg-transparent border-transparent p-0 focus:ring-0 text-sm"
                                />
                                <select
                                    value={solute.unit}
                                    onChange={(e) => handleUnitSelectChange(e.target.value)}
                                    className="bg-transparent border-transparent p-0 focus:ring-0 text-xs text-zinc-400 min-w-[90px]"
                                >
                                    <option value="M">M</option>
                                    <option value="mM">mM</option>
                                    <option value="μM">μM</option>
                                    <option value="μg/mL">μg/mL</option>
                                    <option value="ng/μL">ng/μL</option>
                                    <option value="mg/mL">mg/mL</option>
                                    <option value="mg/L">mg/L</option>
                                    <option value="g/L">g/L</option>
                                    <option value="pct">% (w/v)</option>
                                    <option value="dil">Dilution (X)</option>
                                </select>
                            </>
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-indigo-400 text-lg align-top">
                    <span>{amountWithVolume}</span>
                </td>
                <td className="px-6 py-4 align-top">
                    <button
                        onClick={() => removeSolute(solute.id)}
                        aria-label={`Remove ${solute.name || "solute"}`}
                        className="text-zinc-600 hover:text-red-400 p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </td>
            </tr>
        );
    }

    return (
        <div className="sm:hidden p-4 border-b border-white/5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                    {isChecklist && (
                        <button
                            onClick={() => onToggleCheck(solute.id)}
                            className="mt-1 shrink-0 text-zinc-500 hover:text-emerald-400 transition-colors"
                        >
                            {solute.done ? <CheckSquare className="h-5 w-5 text-emerald-500" /> : <Square className="h-5 w-5" />}
                        </button>
                    )}
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExternalLookup}
                                className="p-1.5 rounded bg-white/5 border border-white/10 text-zinc-500"
                            >
                                <Search className="h-3.5 w-3.5" />
                            </button>
                            {isChecklist ? (
                                <span className="font-bold text-zinc-300">{solute.name}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={solute.name}
                                    onChange={(e) => updateSolute(solute.id, { name: e.target.value })}
                                    className="w-full bg-transparent border-b border-white/10 p-0 text-sm focus:border-indigo-500/50"
                                    placeholder="Name/Formula"
                                />
                            )}
                        </div>
                        {solute.formula && <FormulaBadge formula={solute.formula} className="text-[10px] px-2 py-0.5" />}
                    </div>
                </div>
                <button
                    onClick={() => removeSolute(solute.id)}
                    aria-label={`Remove ${solute.name || "solute"}`}
                    className="text-zinc-600 hover:text-red-400 p-2"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pl-8">
                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">MW</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={solute.mw}
                        disabled={solute.isStock}
                        onChange={(e) => updateSolute(solute.id, { mw: e.target.value })}
                        onBlur={(e) => {
                            const raw = e.target.value;
                            const parsed = parseValueWithUnit(raw, ["g/mol", "g", "mg", "kg"]);
                            if (parsed.value !== "" && Number.isFinite(parseFloat(parsed.value))) {
                                const roundedVal = parseFloat(parseFloat(parsed.value).toFixed(2));
                                updateSolute(solute.id, { mw: roundedVal.toString() });
                            } else {
                                updateSolute(solute.id, { mw: raw.trim() });
                            }
                        }}
                        className="bg-transparent text-sm w-full p-0 border-none"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Target</label>
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={solute.conc}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = parseValueWithUnit(raw, ["M", "mM", "μM", "μg/mL", "ng/μL", "mg/mL", "mg/L", "g/L", "pct", "dil"]);
                                updateSolute(solute.id, { conc: raw });
                                if (parsed.unit) updateSolute(solute.id, { unit: parsed.unit });
                            }}
                            onBlur={(e) => {
                                const raw = e.target.value;
                                const parsed = parseValueWithUnit(raw, ["M", "mM", "μM", "μg/mL", "ng/μL", "mg/mL", "mg/L", "g/L", "pct", "dil"]);
                                if (parsed.unit) updateSolute(solute.id, { unit: parsed.unit });
                                if (parsed.value !== "" && Number.isFinite(parseFloat(parsed.value))) {
                                    updateSolute(solute.id, { conc: parsed.value });
                                } else {
                                    updateSolute(solute.id, { conc: raw.trim() });
                                }
                            }}
                            className="bg-transparent text-sm w-12 p-0 border-none"
                        />
                        <select
                            value={solute.unit}
                            onChange={(e) => handleUnitSelectChange(e.target.value)}
                            className="bg-transparent text-[10px] text-zinc-400 p-0 border-none"
                        >
                            <option value="M">M</option>
                            <option value="mM">mM</option>
                            <option value="μM">μM</option>
                            <option value="μg/mL">μg/mL</option>
                            <option value="ng/μL">ng/μL</option>
                            <option value="mg/mL">mg/mL</option>
                            <option value="mg/L">mg/L</option>
                            <option value="g/L">g/L</option>
                            <option value="pct">%</option>
                            <option value="dil">X</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="pl-8 pt-2 flex items-center justify-between border-t border-white/5 mt-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount Required</span>
                <span className="font-mono font-bold text-indigo-400 text-base">{amountWithVolume}</span>
            </div>
        </div>
    );
}

export default function BufferBuilder() {
    const {
        bufferVolume, setBufferVolume,
        bufferUnit, setBufferUnit,
        solutes, addSolute, clearSolutes, updateSolute,
        setIsRecipeLibraryOpen, setIsSaveRecipeOpen,
        stocks,
        liquidDensities
    } = useStore();
    const { push } = useToastStore();

    const [confirmClear, setConfirmClear] = useState(false);
    const [isChecklist, setIsChecklist] = useState(false);
    const [isStockSelectOpen, setIsStockSelectOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [recipeExportName, setRecipeExportName] = useState("");

    const toggleCheck = useCallback((id: string) => {
        updateSolute(id, { done: !solutes.find((s) => s.id === id)?.done });
    }, [solutes, updateSolute]);

    const handleExport = useCallback((manualName?: string) => {
        // Create new PDF instance
        const doc = new jsPDF();

        // Sanitize string for PDF (replace μ with u to avoid encoding issues)
        const sanitize = (str: string) => str.replace(/μ/g, "u");

        // Title
        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.text(manualName || "Buffer Recipe", 14, 20);

        // Metadata (Date, etc)
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 28);

        // Volume Info
        doc.setFontSize(12);
        doc.setTextColor(60);
        doc.text(sanitize(`Total Volume: ${bufferVolume} ${bufferUnit}`), 14, 38);

        // Prepare table data
        const tableData = solutes.map((s: Solute) => {
            // Helper to calc mass for a solute object
            const getAmountString = (solute: Solute) => {
                const conc = parseFloat(String(solute.conc ?? ""));
                const vol = parseFloat(bufferVolume);
                
                if (isNaN(conc) || isNaN(vol)) return "-";

                let volL = vol;
                if (bufferUnit === "mL") volL = vol / 1000;
                if (bufferUnit === "μL") volL = vol / 1000000;

                if (solute.isStock && solute.stockConc) {
                     const c1 = parseFloat(solute.stockConc);
                     const c2 = conc;
                     // simple simple approximation for typical units if match
                     if (solute.unit === (solute.stockUnit || "")) {
                         return formatVolume((c2 * volL) / c1);
                     }
                     // If units mismatch, it's hard. But likely the user saw it on screen. 
                     // Let's try to handle M/mM at least
                     const isMolar = (u: string) => ['M', 'mM', 'μM'].includes(u);
                     if (isMolar(solute.unit) && solute.stockUnit && isMolar(solute.stockUnit || "")) {
                        let c1Base = c1; 
                        if ((solute.stockUnit || "") === 'mM') c1Base /= 1000;
                        if ((solute.stockUnit || "") === 'μM') c1Base /= 1e6;
                        let c2Base = c2;
                        if (solute.unit === 'mM') c2Base /= 1000;
                        if (solute.unit === 'μM') c2Base /= 1e6;
                        
                        return formatVolume((c2Base * volL) / c1Base);
                     }
                     // Fallback for stock
                     return "See App";
                }
                if (solute.unit === "dil") return formatVolume(volL / conc);

                const massGrams = computeMassRequiredInGrams(solute, bufferVolume, bufferUnit);
                if (!Number.isFinite(massGrams) || massGrams === null || massGrams <= 0) {
                    return "??";
                }
                const massText = formatMass(massGrams);
                const equivalentVolume = computeEquivalentLiquidVolume(
                    solute,
                    bufferVolume,
                    bufferUnit,
                    liquidDensities
                );
                return equivalentVolume ? `${massText} / ${equivalentVolume}` : massText;
            };

            const amount = getAmountString(s);

            let name = s.name;
            if (s.isStock) {
                const stockUnitDisp = (s.stockUnit || "") === 'pct' ? '%' : (s.stockUnit || "");
                name += `\n(STOCK: ${s.stockConc} ${stockUnitDisp})`;
            }

            const unitDisp = s.unit === 'pct' ? '%' : s.unit;

            return [
                "", // Checkbox
                sanitize(name),
                s.mw || "-",
                sanitize(`${s.conc} ${unitDisp}`),
                sanitize(amount)
            ];
        });

        // Generate Table
        autoTable(doc, {
            head: [['', 'Reagent', 'MW', 'Target Conc', 'Amount']],
            body: tableData,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo
            columnStyles: {
                0: { cellWidth: 10, minCellHeight: 10 }, // Checkbox column
                1: { cellWidth: 'auto' },
                2: { cellWidth: 25 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
            },
            didDrawCell: (data) => {
                // Draw checkbox in first column body
                if (data.section === 'body' && data.column.index === 0) {
                    const dim = data.cell.height - 6;
                    const y = data.cell.y + 3;
                    const x = data.cell.x + (data.cell.width - dim) / 2;
                    
                    doc.setDrawColor(150);
                    doc.rect(x, y, dim, dim);
                }
            }
        });

        doc.save("Buffer_Recipe.pdf");
        push("PDF exported.", "success");
    }, [bufferVolume, bufferUnit, solutes, liquidDensities, push]);

    return (
        <div className="space-y-4 sm:space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end glass-card !p-4 no-print">
                <div className="flex-1">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2">Total Solution Volume</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={bufferVolume}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = parseValueWithUnit(raw, ["mL", "μL", "L"]);
                                setBufferVolume(raw);
                                if (parsed.unit) setBufferUnit(parsed.unit);
                            }}
                            onBlur={(e) => {
                                const raw = e.target.value;
                                const parsed = parseValueWithUnit(raw, ["mL", "μL", "L"]);
                                if (parsed.unit) setBufferUnit(parsed.unit);
                                if (parsed.value !== "" && Number.isFinite(parseFloat(parsed.value))) {
                                    setBufferVolume(parsed.value);
                                } else {
                                    setBufferVolume(raw.trim());
                                }
                            }}
                            className="flex-1 sm:w-32 text-sm"
                        />
                        <select
                            value={bufferUnit}
                            onChange={(e) => {
                                const nextUnit = e.target.value;
                                const volumeNum = parseFloat(bufferVolume);
                                if (Number.isFinite(volumeNum)) {
                                    const converted = convertUnitValue(volumeNum, bufferUnit, nextUnit);
                                    if (converted !== null) {
                                        const normalized = parseFloat(converted.toPrecision(8));
                                        setBufferVolume(normalized.toString());
                                    }
                                }
                                setBufferUnit(nextUnit);
                            }}
                            className="w-20 sm:w-24 text-sm"
                        >
                            <option>mL</option>
                            <option>μL</option>
                            <option>L</option>
                        </select>
                    </div>
                </div>

                <div className="flex grid grid-cols-2 sm:flex justify-end items-end gap-2">
                    <button
                        onClick={() => setIsChecklist(!isChecklist)}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold ${isChecklist
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                            }`}
                        title="Preparation Checklist"
                    >
                        {isChecklist ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        <span>Checklist</span>
                    </button>
                    <button
                        onClick={() => setIsRecipeLibraryOpen(true)}
                        className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold"
                        title="Browse Recipes"
                    >
                        <Book className="h-4 w-4" />
                        <span>Library</span>
                    </button>
                    <button
                        onClick={() => setIsSaveRecipeOpen(true)}
                        disabled={solutes.length === 0}
                        className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Save Recipe"
                    >
                        <Save className="h-4 w-4" />
                        <span>Save</span>
                    </button>
                    <button
                        onClick={() => {
                            setRecipeExportName(""); // Reset name
                            setIsExportModalOpen(true);
                        }}
                        disabled={solutes.length === 0}
                        className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Export to PDF"
                    >
                        <Printer className="h-4 w-4" />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            <div className="glass-card !p-0 overflow-hidden border-white/5">
                <table className="hidden sm:table w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">Reagent</th>
                            <th className="px-6 py-4">MW</th>
                            <th className="px-6 py-4">Target Conc</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {solutes.map((solute) => (
                            <SoluteRow
                                key={solute.id}
                                solute={solute}
                                isChecklist={isChecklist}
                                onToggleCheck={toggleCheck}
                                view="table"
                            />
                        ))}
                    </tbody>
                </table>

                {/* Mobile View Placeholder */}
                <div className="sm:hidden flex flex-col">
                    {solutes.map((solute) => (
                        <SoluteRow
                            key={solute.id}
                            solute={solute}
                            isChecklist={isChecklist}
                            onToggleCheck={toggleCheck}
                            view="card"
                        />
                    ))}
                </div>

                {solutes.length === 0 && (
                    <div
                        onClick={() => addSolute()}
                        className="py-12 sm:py-20 text-center flex flex-col items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-zinc-400 group-hover:bg-white/10 transition-colors">
                            <Plus className="h-6 w-6" />
                        </div>
                        <p className="text-zinc-500 italic text-sm px-10">No components added. Click to add one.</p>
                    </div>
                )}

                <div className="grid grid-cols-2 divide-x divide-white/5 border-t border-white/5 bg-white/[0.01]">
                    <button
                        onClick={() => addSolute()}
                        className="py-4 hover:bg-white/[0.03] transition-colors text-zinc-400 font-medium flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Add Ingredient
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setIsStockSelectOpen(!isStockSelectOpen)}
                            className="w-full py-4 hover:bg-white/[0.03] transition-colors text-indigo-400 font-medium flex items-center justify-center gap-2 text-sm"
                        >
                            <Beaker className="h-4 w-4" />
                            From Stock
                        </button>

                        {isStockSelectOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsStockSelectOpen(false)} />
                                <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-[#0f0f11] border border-white/10 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                    {stocks.length === 0 ? (
                                        <div className="p-4 text-center text-zinc-500 text-xs italic">
                                            No stocks saved yet. Add one in the Stock Buffers tab.
                                        </div>
                                    ) : (
                                        stocks.map(stock => (
                                            <button
                                                key={stock.id}
                                                onClick={() => {
                                                    addSolute({
                                                        name: stock.name,
                                                        mw: stock.mw.toString(),
                                                        formula: stock.formula,
                                                        isStock: true,
                                                        stockConc: stock.concentration,
                                                        stockUnit: stock.unit
                                                    });
                                                    setIsStockSelectOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0"
                                            >
                                                <div className="text-sm font-bold text-white">{stock.name}</div>
                                                <div className="text-xs text-zinc-400 font-mono">
                                                    Stock: {stock.concentration} {stock.unit === 'pct' ? '%' : stock.unit}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                {confirmClear ? (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-sm text-zinc-500 font-medium">Clear everything?</span>
                        <button
                            onClick={() => {
                                clearSolutes();
                                setConfirmClear(false);
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => setConfirmClear(false)}
                            className="bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                            No
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmClear(true)}
                        className="p-2 px-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all text-xs font-bold flex items-center gap-2"
                    >
                        <Trash2 className="h-3 w-3" />
                        Clear Recipe
                    </button>
                )}
            </div>

            {/* Export Name Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsExportModalOpen(false)} />
                    <div className="relative glass-card !p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                                <Printer className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Export Recipe</h3>
                                <p className="text-zinc-400 text-sm">Enter a name for the PDF report (or leave it blank)</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Recipe Name</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={recipeExportName}
                                    onChange={(e) => setRecipeExportName(e.target.value)}
                                    placeholder="Buffer Recipe"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleExport(recipeExportName);
                                            setIsExportModalOpen(false);
                                        }
                                    }}
                                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-3 outline-none transition-all text-white placeholder:text-white/10"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        handleExport(recipeExportName);
                                        setIsExportModalOpen(false);
                                    }}
                                    className="flex-1 px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all text-sm font-bold shadow-lg shadow-indigo-500/20"
                                >
                                    Export PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
