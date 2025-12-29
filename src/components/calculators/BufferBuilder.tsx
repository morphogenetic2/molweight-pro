"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { Trash2, Plus, Search, Loader2, Book, Save, Square, CheckSquare } from "lucide-react";
import { FormulaBadge } from "../ui/FormulaBadge";
import { formatMass, formatVolume, formatConcentration, parseFormula, calculateMw, getUnitLabel } from "@/lib/parser";
import { lookupPubChem } from "@/lib/api";

// Simple debounce helper since I didn't check for lodash
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

function SoluteRow({ solute, isChecklist, onToggleCheck, view = 'table' }: { solute: any; isChecklist: boolean; onToggleCheck: (id: string) => void; view?: 'table' | 'card' }) {
    const { bufferVolume, bufferUnit, removeSolute, updateSolute } = useStore();
    const [isSearching, setIsSearching] = useState(false);

    const debouncedName = useDebounce(solute.name, 600);

    useEffect(() => {
        const triggerLookup = async () => {
            const query = debouncedName.trim();
            if (!query) return;

            if (solute.formula === query) return;

            setIsSearching(true);
            try {
                if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(query) && /[A-Z]/.test(query)) {
                    try {
                        const composition = parseFormula(query);
                        const mw = calculateMw(composition);
                        updateSolute(solute.id, { mw: mw.toFixed(2), formula: query });
                        setIsSearching(false);
                        return;
                    } catch (e) { }
                }

                const res = await lookupPubChem(query);
                if (res) {
                    updateSolute(solute.id, {
                        mw: res.mw ? String(res.mw.toFixed(2)) : "",
                        formula: res.formula ? String(res.formula) : "",
                        cid: res.cid ? Number(res.cid) : undefined
                    });
                }
            } catch (err) {
                console.error("Lookup error:", err);
            } finally {
                setIsSearching(false);
            }
        };

        triggerLookup();
    }, [debouncedName, solute.id, updateSolute]);

    const calculateMass = () => {
        const mw = parseFloat(solute.mw);
        const conc = parseFloat(solute.conc);
        const vol = parseFloat(bufferVolume);

        if (isNaN(conc) || isNaN(vol)) return "-";

        let volL = vol;
        if (bufferUnit === "mL") volL = vol / 1000;
        if (bufferUnit === "μL") volL = vol / 1000000;

        if (solute.isStock && solute.stockConc) {
            const c1 = parseFloat(solute.stockConc);
            const u1 = solute.stockUnit;
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
            let c2Base = normalizeToBase(c2, u2);

            if (domain1 !== domain2 && domain1 && domain2) {
                if (isNaN(mw) || mw <= 0) return "Mw?";
                if (domain2 === 'molar' && domain1 === 'mass') {
                    c1Base = c1Base / mw;
                } else if (domain2 === 'mass' && domain1 === 'molar') {
                    c1Base = c1Base * mw;
                }
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
                                                    {formatConcentration(solute.stockConc, solute.stockUnit)} {getUnitLabel(solute.stockUnit)}
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
                    <input
                        type="number"
                        placeholder="0.00"
                        value={solute.mw}
                        disabled={solute.isStock}
                        onChange={(e) => updateSolute(solute.id, { mw: e.target.value })}
                        className={`w-24 bg-transparent border-transparent p-0 focus:ring-0 text-sm ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
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
                                    type="number"
                                    value={solute.conc}
                                    disabled={solute.isStock}
                                    onChange={(e) => updateSolute(solute.id, { conc: e.target.value })}
                                    className={`w-20 bg-transparent border-transparent p-0 focus:ring-0 text-sm ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                                <select
                                    value={solute.unit}
                                    disabled={solute.isStock}
                                    onChange={(e) => updateSolute(solute.id, { unit: e.target.value })}
                                    className={`bg-transparent border-transparent p-0 focus:ring-0 text-xs text-zinc-400 min-w-[90px] ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    {calculateMass()}
                </td>
                <td className="px-6 py-4 align-top">
                    <button
                        onClick={() => removeSolute(solute.id)}
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
                    className="text-zinc-600 hover:text-red-400 p-2"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pl-8">
                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">MW</label>
                    <input
                        type="number"
                        value={solute.mw}
                        disabled={solute.isStock}
                        onChange={(e) => updateSolute(solute.id, { mw: e.target.value })}
                        className="bg-transparent text-sm w-full p-0 border-none"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Target</label>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            value={solute.conc}
                            disabled={solute.isStock}
                            onChange={(e) => updateSolute(solute.id, { conc: e.target.value })}
                            className="bg-transparent text-sm w-12 p-0 border-none"
                        />
                        <select
                            value={solute.unit}
                            disabled={solute.isStock}
                            onChange={(e) => updateSolute(solute.id, { unit: e.target.value })}
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
                <span className="font-mono font-bold text-indigo-400 text-base">{calculateMass()}</span>
            </div>
        </div>
    );
}

export default function BufferBuilder() {
    const {
        bufferVolume, setBufferVolume,
        bufferUnit, setBufferUnit,
        solutes, addSolute, clearSolutes, updateSolute,
        setIsRecipeLibraryOpen, setIsSaveRecipeOpen
    } = useStore();

    const [confirmClear, setConfirmClear] = useState(false);
    const [isChecklist, setIsChecklist] = useState(false);

    const toggleCheck = useCallback((id: string) => {
        updateSolute(id, { done: !solutes.find((s: any) => s.id === id)?.done });
    }, [solutes, updateSolute]);

    return (
        <div className="space-y-4 sm:space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end glass-card !p-4 no-print">
                <div className="flex-1">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2">Total Solution Volume</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={bufferVolume}
                            onChange={(e) => setBufferVolume(e.target.value)}
                            className="flex-1 sm:w-32 text-sm"
                        />
                        <select
                            value={bufferUnit}
                            onChange={(e) => setBufferUnit(e.target.value)}
                            className="w-20 sm:w-24 text-sm"
                        >
                            <option>mL</option>
                            <option>μL</option>
                            <option>L</option>
                        </select>
                    </div>
                </div>

                <div className="flex grid grid-cols-3 sm:flex justify-end items-end gap-2">
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
                        {solutes.map((solute: any) => (
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
                    {solutes.map((solute: any) => (
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

                <button
                    onClick={() => addSolute()}
                    className="w-full py-4 border-t border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-zinc-400 font-medium flex items-center justify-center gap-2 text-sm"
                >
                    <Plus className="h-4 w-4" />
                    Add Ingredient
                </button>
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
                        className="secondary text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all text-xs"
                    >
                        Clear Recipe
                    </button>
                )}
            </div>
        </div>
    );
}
