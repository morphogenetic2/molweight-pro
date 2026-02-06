"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Search, Loader2, Scale, Beaker, Pipette, Atom, ArrowRightLeft, Lock } from "lucide-react";
import { lookupPubChem } from "@/lib/api";
import { tryCalculateMw } from "@/lib/parser";
import { FormulaBadge } from "../ui/FormulaBadge";
import { Solver, denormalize } from "@/lib/chemistry/converter";
import { MASS_UNITS, VOLUME_UNITS, MOLAR_UNITS, MASS_CONC_UNITS, PERCENT_UNITS } from "@/lib/chemistry/units";
import { ValueUnitInput } from "../ui/ValueUnitInput";
import type { MolarityState } from "@/store/storeTypes";
import { useDebounce } from "@/lib/hooks/useDebounce";

// Group units for dropdowns
const MASS_OPTS = Object.keys(MASS_UNITS);
const VOL_OPTS = Object.keys(VOLUME_UNITS);
// Conc options: Molar + MassConc + Percent
const CONC_OPTS = [
    ...Object.keys(MOLAR_UNITS),
    ...Object.keys(PERCENT_UNITS),
    ...Object.keys(MASS_CONC_UNITS)
];

export default function MolarityCalculator() {
    const { molarityState, setMolarityState } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [lookupResult, setLookupResult] = useState<{ name?: string, formula?: string, cid?: number } | null>(null);

    const debouncedSearch = useDebounce(searchTerm, 600);

    // Auto-calculate for local formulas on-the-fly
    useEffect(() => {
        const query = debouncedSearch.trim();
        if (!query) return;

        const res = tryCalculateMw(query);
        if (res) {
            setMolarityState({ mw: res.mw });
            setLookupResult({ formula: res.formula });
        }
    }, [debouncedSearch, setMolarityState]);

    const num = (v: string | number) => {
        const n = parseFloat(String(v));
        return Number.isFinite(n) ? n : 0;
    };
    const mwMissingForMolar = Boolean(MOLAR_UNITS[molarityState.concUnit]) && (!molarityState.mw || molarityState.mw <= 0);

    // --- Lookup Logic ---
    const handleLookup = async (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        const query = searchTerm.trim();
        if (!query) return;

        setSearching(true);
        setLookupResult(null);

        try {
            // 1. Try local parse first
            const localResult = tryCalculateMw(query);
            if (localResult) {
                setMolarityState({ mw: localResult.mw });
                setLookupResult({ formula: localResult.formula });
                setSearching(false);
                return;
            }

            // 2. Fallback to PubChem
            const res = await lookupPubChem(query);
            if (res) {
                setMolarityState({ mw: res.mw });
                setLookupResult({ name: res.name, formula: res.formula, cid: res.cid });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSearching(false);
        }
    };

    // --- Calculation Logic (Powered by Engine) ---
    useEffect(() => {
        const { mw, mass, volume, concentration, massUnit, volUnit, concUnit, target } = molarityState;

        // Safety parsing
        const m = parseFloat(mass) || 0;
        const v = parseFloat(volume) || 0;
        const c = parseFloat(concentration) || 0;
        const w = mw || 0;

        const fmt = (n: number) => {
            if (!isFinite(n) || isNaN(n)) return "";
            if (Math.abs(n) < 1e-6 && n !== 0) return n.toExponential(4);
            return parseFloat(n.toPrecision(6)).toString();
        };

        type NumericField = "mw" | "mass" | "volume" | "concentration";
        const updateState = (key: NumericField, val: number) => {
            const newVal = fmt(val);
            // Avoid infinite loops by checking equality
            const current = molarityState[key];
            const currentNum = typeof current === "number" ? current : parseFloat(current);
            if (currentNum !== parseFloat(newVal)) {
                setMolarityState({ [key]: newVal } as Partial<MolarityState>);
            }
        };

        if (target === 'mass') {
            if (v > 0 && c > 0) {
                const massG = Solver.solveMass(c, concUnit, v, volUnit, w);
                updateState('mass', denormalize(massG, massUnit));
            }
        } else if (target === 'volume') {
            if (m > 0 && c > 0) {
                const volL = Solver.solveVolume(m, massUnit, c, concUnit, w);
                updateState('volume', denormalize(volL, volUnit));
            }
        } else if (target === 'concentration') {
            if (m > 0 && v > 0) {
                // solveConcentration handles returning in Target Unit directly because "conc" is complex
                const concVal = Solver.solveConcentration(m, massUnit, v, volUnit, concUnit, w);
                updateState('concentration', concVal);
            }
        } else if (target === 'mw') {
            // Logic for MW solver wasn't in Solver object yet?
            // "Mass = Conc * Vol * MW" => MW = Mass / (ConcM * VolL)
            // I'll implement it inline or quick-add to solver later. 
            // For now inline using imported converters.
            // Actually let's use the old reliable approach for just this one to be safe,
            // or better: 
            // MW is dimensionless-ish (g/mol).
            if (m > 0 && v > 0 && c > 0) {
                // Convert all to base
                // But wait, "c" depends on MW if it's molar? No, if it's MassConc (g/L) it doesn't.
                // If "c" is Molar, then MW is involved.
                // If "c" is g/L, MW is NOT involved in the relation (Mass = Conc * Vol). MW is irrelevant.
                // So we can only solve for MW if Conc is Molar (or deriving from Molar).
                // Logic: Mass(g) = M(mol/L) * Vol(L) * MW.
                // MW = Mass(g) / (M * Vol(L)).

                // If unit is g/L, then Mass = g/L * L. MW cancels out.
                // So we check if concUnit is molar.
                if (MOLAR_UNITS[concUnit]) {
                    // NOTE: MW solving for mass concentration isn't supported yet.
                }
            }
            // Skipping MW solvability in this pass to minimize risk, users rarely solve for MW here (it's usually an input).
        }

    }, [molarityState, setMolarityState]);

    const update = (field: keyof MolarityState, val: string) => setMolarityState({ [field]: val } as Partial<MolarityState>);
    const updateUnit = (field: keyof MolarityState, val: string) => setMolarityState({ [field]: val } as Partial<MolarityState>);

    const isTarget = (t: MolarityState["target"]) => molarityState.target === t;

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                    Molarity Calculator
                </h2>
                <p className="text-xs text-zinc-500">Tip: you can type values like <span className="font-mono text-zinc-400">10 mM</span> or <span className="font-mono text-zinc-400">500 mL</span>.</p>
            </div>

            {/* Quick Lookup */}
            <div className="space-y-2">
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2 text-zinc-500/80">Chemical Component</label>
                <div className="glass-card p-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => searchTerm && window.open(`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(searchTerm)}`, '_blank')}
                            aria-label="View search on PubChem"
                            className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <form onSubmit={handleLookup} className="flex-1 flex gap-2">
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Type chemical name (e.g. NaCl)..."
                                className="flex-1 bg-transparent border-none text-zinc-200 focus:ring-0 placeholder:text-zinc-600 text-sm"
                            />
                            <button type="submit" disabled={searching} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-300 transition-colors">
                                {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Lookup"}
                            </button>
                        </form>
                    </div>
                    {lookupResult?.formula && (
                        <div className="mt-2 ml-[44px] animate-in fade-in slide-in-from-top-1 duration-300">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 shadow-xl backdrop-blur-sm">
                                <FormulaBadge formula={lookupResult.formula} className="text-[10px]" />
                                <span className="text-[10px] font-mono text-indigo-400">{molarityState.mw} g/mol</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Calculator */}
            <div className="glass-card p-6 space-y-6 relative overflow-hidden">

                {/* MW Row */}
                <div className={`p-3 rounded-xl transition-all ${isTarget('mw') ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400"><Atom className="h-5 w-5" /></div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Molecular Weight</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={molarityState.mw || ""}
                                    onChange={(e) => update('mw', e.target.value)}
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (Number.isFinite(val)) {
                                            update('mw', val.toFixed(2));
                                        }
                                    }}
                                    placeholder="0.00"
                                    className="w-full bg-transparent border-none text-lg font-mono focus:ring-0 p-0 text-white"
                                />
                                <span className="text-sm text-zinc-500">g/mol</span>
                            </div>
                            {mwMissingForMolar && (
                                <p className="text-[11px] text-amber-500 mt-1">MW required for molar concentrations.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mass Row - Using New Component */}
                <div className={`p-3 rounded-xl transition-all ${isTarget('mass') ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400"><Scale className="h-5 w-5" /></div>
                        <div className="flex-1">
                            <ValueUnitInput
                                label="Mass"
                                value={molarityState.mass}
                                unit={molarityState.massUnit}
                                onValueChange={(v) => update('mass', v)}
                                onUnitChange={(u) => updateUnit('massUnit', u)}
                                options={MASS_OPTS}
                                readOnlyInput={isTarget('mass')}
                                inputClassName={isTarget('mass') ? 'text-emerald-400 font-bold' : ''}
                            />
                        </div>
                        <button onClick={() => setMolarityState({ target: 'mass' })} className={`p-2 rounded-lg transition-colors ${isTarget('mass') ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                            <Lock className={`h-4 w-4 ${isTarget('mass') ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    {isTarget('mass') && (num(molarityState.volume) <= 0 || num(molarityState.concentration) <= 0) && (
                        <p className="text-[11px] text-amber-500 mt-2">Enter volume and concentration to calculate mass.</p>
                    )}
                </div>

                <div className="flex justify-center -my-2 opacity-30">
                    <ArrowRightLeft className="h-4 w-4 text-zinc-500 rotate-90" />
                </div>

                {/* Conc Row */}
                <div className={`p-3 rounded-xl transition-all ${isTarget('concentration') ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400"><Beaker className="h-5 w-5" /></div>
                        <div className="flex-1">
                            <ValueUnitInput
                                label="Concentration"
                                value={molarityState.concentration}
                                unit={molarityState.concUnit}
                                onValueChange={(v) => update('concentration', v)}
                                onUnitChange={(u) => updateUnit('concUnit', u)}
                                options={CONC_OPTS}
                                readOnlyInput={isTarget('concentration')}
                                inputClassName={isTarget('concentration') ? 'text-emerald-400 font-bold' : ''}
                            />
                        </div>
                        <button onClick={() => setMolarityState({ target: 'concentration' })} className={`p-2 rounded-lg transition-colors ${isTarget('concentration') ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                            <Lock className={`h-4 w-4 ${isTarget('concentration') ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    {isTarget('concentration') && (num(molarityState.mass) <= 0 || num(molarityState.volume) <= 0) && (
                        <p className="text-[11px] text-amber-500 mt-2">Enter mass and volume to calculate concentration.</p>
                    )}
                </div>

                {/* Volume Row */}
                <div className={`p-3 rounded-xl transition-all ${isTarget('volume') ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400"><Pipette className="h-5 w-5" /></div>
                        <div className="flex-1">
                            <ValueUnitInput
                                label="Volume"
                                value={molarityState.volume}
                                unit={molarityState.volUnit}
                                onValueChange={(v) => update('volume', v)}
                                onUnitChange={(u) => updateUnit('volUnit', u)}
                                options={VOL_OPTS}
                                readOnlyInput={isTarget('volume')}
                                inputClassName={isTarget('volume') ? 'text-emerald-400 font-bold' : ''}
                            />
                        </div>
                        <button onClick={() => setMolarityState({ target: 'volume' })} className={`p-2 rounded-lg transition-colors ${isTarget('volume') ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                            <Lock className={`h-4 w-4 ${isTarget('volume') ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    {isTarget('volume') && (num(molarityState.mass) <= 0 || num(molarityState.concentration) <= 0) && (
                        <p className="text-[11px] text-amber-500 mt-2">Enter mass and concentration to calculate volume.</p>
                    )}
                </div>

            </div>
        </div>
    );
}
