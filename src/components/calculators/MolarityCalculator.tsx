"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Search, Loader2, Scale, Beaker, Pipette, Atom, ArrowRightLeft, Lock } from "lucide-react";
import { lookupPubChem } from "@/lib/api";
import { parseFormula, calculateMw } from "@/lib/parser";
import { FormulaBadge } from "../ui/FormulaBadge";
import { Solver, denormalize } from "@/lib/chemistry/converter";
import { MASS_UNITS, VOLUME_UNITS, MOLAR_UNITS, MASS_CONC_UNITS, PERCENT_UNITS } from "@/lib/chemistry/units";
import { ValueUnitInput } from "../ui/ValueUnitInput";
import type { MolarityState } from "@/store/storeTypes";
import Image from "next/image";

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

    // --- Lookup Logic ---
    const handleLookup = async (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        const query = searchTerm.trim();
        if (!query) return;

        setSearching(true);
        setLookupResult(null);

        try {
            if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(query) && /[A-Z]/.test(query)) {
                try {
                    const comp = parseFormula(query);
                    const mw = calculateMw(comp);
                    setMolarityState({ mw });
                    setLookupResult({ formula: query });
                    setSearching(false);
                    return;
                } catch { }
            }

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
                    Molarity Calculator 2.0
                </h2>
            </div>

            {/* Quick Lookup */}
            <div className="space-y-4">
                <div className="glass-card p-4 flex items-center gap-3">
                    <button onClick={() => searchTerm && window.open(`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(searchTerm)}`, '_blank')}
                        className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                    >
                        <Search className="h-5 w-5" />
                    </button>
                    <form onSubmit={handleLookup} className="flex-1 flex gap-2">
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type chemical name (e.g. NaCl)..."
                            className="flex-1 bg-transparent border-none text-zinc-200 focus:ring-0 placeholder:text-zinc-600"
                        />
                        <button type="submit" disabled={searching} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium text-zinc-300 transition-colors">
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                        </button>
                    </form>
                </div>
                {lookupResult && (
                    <div className="glass-card px-6 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        {lookupResult.cid && (
                            <Image
                                src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${lookupResult.cid}/PNG?record_type=2d&image_size=50x50`}
                                alt={lookupResult.name || lookupResult.formula || "Structure"}
                                width={50}
                                height={50}
                                className="h-10 w-10 object-contain opacity-80"
                            />
                        )}
                        <div className="text-sm">
                            <span className="text-zinc-400">Result: </span>
                            <span className="text-white font-medium">{lookupResult.name || lookupResult.formula}</span>
                            {lookupResult.formula && <span className="ml-2 text-xs text-zinc-500 font-mono"><FormulaBadge formula={lookupResult.formula} className="inline-block" /></span>}
                        </div>
                    </div>
                )}
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
                                    placeholder="0.00"
                                    className="w-full bg-transparent border-none text-lg font-mono focus:ring-0 p-0 text-white"
                                />
                                <span className="text-sm text-zinc-500">g/mol</span>
                            </div>
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
                </div>

            </div>
        </div>
    );
}
