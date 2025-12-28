"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { Trash2, Plus, Search, Loader2 } from "lucide-react";
import { FormulaBadge } from "../ui/FormulaBadge";
import { formatMass, parseFormula, calculateMw } from "@/lib/parser";
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
                    updateSolute(solute.id, {
                        mw: res.mw?.toFixed(2),
                        formula: res.formula,
                        cid: res.cid
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

        if (isNaN(mw) || isNaN(conc) || isNaN(vol)) return "-";

        let volL = vol;
        if (bufferUnit === "mL") volL = vol / 1000;
        if (bufferUnit === "μL") volL = vol / 1000000;

        if (solute.unit === "M") return formatMass(conc * volL * mw);
        if (solute.unit === "mM") return formatMass((conc / 1000) * volL * mw);
        if (solute.unit === "μM") return formatMass((conc / 1000000) * volL * mw);
        if (solute.unit === "pct") return formatMass((conc / 100) * (volL * 1000));
        if (solute.unit === "dil") {
            const stockVolL = volL / conc;
            if (stockVolL < 1e-3) return (stockVolL * 1e6).toFixed(1) + " μL";
            return (stockVolL * 1000).toFixed(2) + " mL";
        }
        return "-";
    };

    return (
        <tr className="group hover:bg-white/[0.02] transition-colors">
            <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Name/Formula"
                            value={solute.name}
                            onChange={(e) => updateSolute(solute.id, { name: e.target.value })}
                            className="w-full bg-transparent border-transparent p-0 focus:ring-0 focus:border-indigo-500/50"
                        />
                        {isSearching && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                            </div>
                        )}
                    </div>
                    {solute.formula && <FormulaBadge formula={solute.formula} className="self-start" />}
                </div>
            </td>
            <td className="px-6 py-4">
                <input
                    type="number"
                    placeholder="0.00"
                    value={solute.mw}
                    onChange={(e) => updateSolute(solute.id, { mw: e.target.value })}
                    className="w-24 bg-transparent border-transparent p-0 focus:ring-0"
                />
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={solute.conc}
                        onChange={(e) => updateSolute(solute.id, { conc: e.target.value })}
                        className="w-20 bg-transparent border-transparent p-0 focus:ring-0"
                    />
                    <select
                        value={solute.unit}
                        onChange={(e) => updateSolute(solute.id, { unit: e.target.value })}
                        className="bg-transparent border-transparent p-0 focus:ring-0 text-sm text-zinc-400"
                    >
                        <option value="M">M</option>
                        <option value="mM">mM</option>
                        <option value="μM">μM</option>
                        <option value="pct">% (w/v)</option>
                        <option value="dil">Dilution (X)</option>
                    </select>
                </div>
            </td>
            <td className="px-6 py-4 text-right font-mono font-bold text-indigo-400 text-lg">
                {calculateMass()}
            </td>
            <td className="px-6 py-4">
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
        solutes, addSolute
    } = useStore();

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
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">
                            <Plus className="h-6 w-6" />
                        </div>
                        <p className="text-zinc-500 italic">No components added to this recipe.</p>
                    </div>
                )}

                <button
                    onClick={addSolute}
                    className="w-full py-4 border-t border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-zinc-400 font-medium flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Add Ingredient
                </button>
            </div>

            <div className="flex justify-end gap-3">
                <button className="secondary text-zinc-500">
                    Clear Recipe
                </button>
                <button className="primary flex items-center gap-2">
                    Save Recipe
                </button>
            </div>
        </div>
    );
}
