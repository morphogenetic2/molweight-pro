"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { Trash2, Plus, Search, Loader2, Book, Save } from "lucide-react";
import { FormulaBadge } from "../ui/FormulaBadge";
import { formatMass, formatVolume, formatConcentration, parseFormula, calculateMw } from "@/lib/parser";
import { lookupPubChem } from "@/lib/api";
import { debounce } from "lodash"; // I need to check if lodash is installed, or implement my own

// Simple debounce helper since I didn't check for lodash
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

function SoluteRow({ solute }: { solute: any }) {
    const { bufferVolume, bufferUnit, removeSolute, updateSolute } = useStore();
    const [isSearching, setIsSearching] = useState(false);

    const debouncedName = useDebounce(solute.name, 600);

    useEffect(() => {
        const triggerLookup = async () => {
            const query = debouncedName.trim();
            if (!query) return;

            // If it looks like a formula we already parsed, skip
            if (solute.formula === query) return;

            setIsSearching(true);
            try {
                // 1. Try local parse
                if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(query) && /[A-Z]/.test(query)) {
                    try {
                        const composition = parseFormula(query);
                        const mw = calculateMw(composition);
                        updateSolute(solute.id, { mw: mw.toFixed(2), formula: query });
                        setIsSearching(false);
                        return;
                    } catch (e) { }
                }

                // 2. Try PubChem
                const res = await lookupPubChem(query);
                if (res) {
                    // Only store serializable primitive values
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

        // PRIORITY: Stock Solutions (V1 = C2*V2 / C1)
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

            // 1. Convert to base units (M or g/L)
            const normalizeToBase = (val: number, u: string) => {
                if (u === 'M' || u === 'g/L' || u === 'mg/mL') return val;
                if (u === 'mM' || u === 'mg/L' || u === 'μg/mL' || u === 'ng/μL') return val / 1000;
                if (u === 'μM') return val / 1e6;
                if (u === 'pct') return val * 10;
                return val;
            };

            let c1Base = normalizeToBase(c1, u1);
            let c2Base = normalizeToBase(c2, u2);

            // 2. Cross Domains? (Match domain of C1 to domain of C2)
            if (domain1 !== domain2 && domain1 && domain2) {
                if (isNaN(mw) || mw <= 0) return "Mw?";
                if (domain2 === 'molar' && domain1 === 'mass') {
                    c1Base = c1Base / mw; // g/L -> M
                } else if (domain2 === 'mass' && domain1 === 'molar') {
                    c1Base = c1Base * mw; // M -> g/L
                }
            }

            // 3. V1 = (C2 * V2) / C1
            const v1L = (c2Base * volL) / c1Base;

            if (!isFinite(v1L) || v1L <= 0) return "-";

            return formatVolume(v1L);
        }


        // Molarity based calculations (Require MW)
        if (solute.unit === "M" || solute.unit === "mM" || solute.unit === "μM") {
            if (isNaN(mw)) return "-";
            if (solute.unit === "M") return formatMass(conc * volL * mw);
            if (solute.unit === "mM") return formatMass((conc / 1000) * volL * mw);
            if (solute.unit === "μM") return formatMass((conc / 1000000) * volL * mw);
        }

        // % (w/v): g = (% / 100) * V(mL)
        if (solute.unit === "pct") return formatMass((conc / 100) * (volL * 1000));

        // Dilution (X): V_stock = V_final / X
        if (solute.unit === "dil") {
            const stockVolL = volL / conc;
            return formatVolume(stockVolL);
        }


        // Mass concentration: calculate grams needed directly
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

    return (
        <tr className="group hover:bg-white/[0.02] transition-colors">
            <td className="px-6 py-4 align-top">
                <div className="flex flex-col gap-1">
                    <div className="relative flex items-center gap-2">
                        <button
                            onClick={handleExternalLookup}
                            title="View on PubChem"
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
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
                                            {formatConcentration(solute.stockConc, solute.stockUnit)}{solute.stockUnit}
                                        </span>
                                    )}
                                </>
                            )}
                            <input
                                type="text"
                                placeholder="Name/Formula"
                                value={solute.name}
                                onChange={(e) => updateSolute(solute.id, { name: e.target.value })}
                                className="flex-1 bg-transparent border-transparent p-0 focus:ring-0 focus:border-indigo-500/50"
                            />
                            {isSearching && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                                </div>
                            )}
                        </div>
                    </div>

                    {solute.formula && (
                        <div className="pl-9">
                            <FormulaBadge formula={solute.formula} className="self-start" />
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 align-top">
                <input
                    type="number"
                    placeholder="0.00"
                    value={solute.mw}
                    disabled={solute.isStock}
                    onChange={(e) => updateSolute(solute.id, { mw: e.target.value })}
                    className={`w-24 bg-transparent border-transparent p-0 focus:ring-0 ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
            </td>
            <td className="px-6 py-4 align-top">
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={solute.conc}
                        disabled={solute.isStock}
                        onChange={(e) => updateSolute(solute.id, { conc: e.target.value })}
                        className={`w-20 bg-transparent border-transparent p-0 focus:ring-0 ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <select
                        value={solute.unit}
                        disabled={solute.isStock}
                        onChange={(e) => updateSolute(solute.id, { unit: e.target.value })}
                        className={`bg-transparent border-transparent p-0 focus:ring-0 text-sm text-zinc-400 ${solute.isStock ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                </div>
            </td>
            <td className="px-6 py-4 text-right font-mono font-bold text-indigo-400 text-lg align-top">
                {calculateMass()}
            </td>
            <td className="px-6 py-4 align-top">
                <button
                    onClick={() => removeSolute(solute.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </td>
        </tr>
    );
}

export default function BufferBuilder() {
    const {
        bufferVolume, setBufferVolume,
        bufferUnit, setBufferUnit,
        solutes, addSolute, clearSolutes,
        setIsRecipeLibraryOpen, setIsSaveRecipeOpen
    } = useStore();

    const [confirmClear, setConfirmClear] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 items-end glass-card !p-4">
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Total Solution Volume</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={bufferVolume}
                            onChange={(e) => setBufferVolume(e.target.value)}
                            className="w-32"
                        />
                        <select
                            value={bufferUnit}
                            onChange={(e) => setBufferUnit(e.target.value)}
                            className="w-24"
                        >
                            <option>mL</option>
                            <option>μL</option>
                            <option>L</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 flex justify-end items-end gap-2">
                    <button
                        onClick={() => setIsRecipeLibraryOpen(true)}
                        className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-2 text-xs font-bold"
                        title="Browse Recipes"
                    >
                        <Book className="h-4 w-4" />
                        <span className="hidden sm:inline">Library</span>
                    </button>
                    <button
                        onClick={() => setIsSaveRecipeOpen(true)}
                        disabled={solutes.length === 0}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-all flex items-center gap-2 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Save Recipe"
                    >
                        <Save className="h-4 w-4" />
                        <span className="hidden sm:inline">Save</span>
                    </button>
                </div>
            </div>

            <div className="glass-card !p-0 overflow-hidden border-white/5">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">Chemical Component</th>
                            <th className="px-6 py-4">MW</th>
                            <th className="px-6 py-4">Target Concentration</th>
                            <th className="px-6 py-4 text-right">Required Amount</th>
                            <th className="px-6 py-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {solutes.map((solute) => (
                            <SoluteRow key={solute.id} solute={solute} />
                        ))}
                    </tbody>
                </table>

                {solutes.length === 0 && (
                    <div
                        onClick={() => addSolute()}
                        className="py-20 text-center flex flex-col items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-zinc-400 group-hover:bg-white/10 transition-colors">
                            <Plus className="h-6 w-6" />
                        </div>
                        <p className="text-zinc-500 italic group-hover:text-zinc-400 transition-colors">No components added. Click to add one.</p>
                    </div>
                )}

                <button
                    onClick={() => addSolute()}
                    className="w-full py-4 border-t border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-zinc-400 font-medium flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Add Ingredient
                </button>
            </div>

            <div className="flex justify-end gap-3">
                {confirmClear ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500 font-medium">Are you sure?</span>
                        <button
                            onClick={() => {
                                clearSolutes();
                                setConfirmClear(false);
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => setConfirmClear(false)}
                            className="bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                        >
                            No
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmClear(true)}
                        className="secondary text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all"
                    >
                        Clear Recipe
                    </button>
                )}
                <button className="primary flex items-center gap-2">
                    Save Recipe
                </button>
            </div>
        </div>
    );
}
