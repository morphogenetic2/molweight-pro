"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Search, Loader2, Scale, Beaker, Pipette, Atom, Calculator, ArrowRightLeft, Lock } from "lucide-react";
import { lookupPubChem } from "@/lib/api";
import { parseFormula, calculateMw } from "@/lib/parser";
import { FormulaBadge } from "../ui/FormulaBadge";

export default function MolarityCalculator() {
    const { molarityState, setMolarityState } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [lookupResult, setLookupResult] = useState<{ name?: string, formula?: string, cid?: number } | null>(null);

    // --- Lookup Logic ---
    const handleLookup = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const query = searchTerm.trim();
        if (!query) return;

        setSearching(true);
        setLookupResult(null);

        try {
            // 1. Try local parse
            if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(query) && /[A-Z]/.test(query)) {
                try {
                    const comp = parseFormula(query);
                    const mw = calculateMw(comp);
                    setMolarityState({ mw });
                    setLookupResult({ formula: query });
                    setSearching(false);
                    return;
                } catch (e) { }
            }

            // 2. PubChem
            const res = await lookupPubChem(query);
            if (res) {
                setMolarityState({ mw: res.mw });
                setLookupResult({
                    name: res.name,
                    formula: res.formula,
                    cid: res.cid
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    // --- Calculation Logic ---
    useEffect(() => {
        const { mw, mass, volume, concentration, massUnit, volUnit, concUnit, target } = molarityState;

        const m = parseFloat(mass);
        const v = parseFloat(volume);
        const c = parseFloat(concentration);
        const w = mw;

        // Helper to convert TO base units (g, L, M)
        const toBase = (val: number, unit: string) => {
            if (unit === 'mg') return val / 1e3;
            if (unit === 'μg') return val / 1e6;
            if (unit === 'ng') return val / 1e9;
            if (unit === 'kg') return val * 1e3;

            if (unit === 'mL') return val / 1e3;
            if (unit === 'μL') return val / 1e6;
            if (unit === 'nL') return val / 1e9;

            if (unit === 'mM') return val / 1e3;
            if (unit === 'μM') return val / 1e6;
            if (unit === 'nM') return val / 1e9;

            return val; // g, L, M
        };

        // Helper to convert FROM base units
        const fromBase = (val: number, unit: string) => {
            if (unit === 'mg') return val * 1e3;
            if (unit === 'μg') return val * 1e6;
            if (unit === 'ng') return val * 1e9;
            if (unit === 'kg') return val / 1e3;

            if (unit === 'mL') return val * 1e3;
            if (unit === 'μL') return val * 1e6;
            if (unit === 'nL') return val * 1e9;

            if (unit === 'mM') return val * 1e3;
            if (unit === 'μM') return val * 1e6;
            if (unit === 'nM') return val * 1e9;

            return val;
        };

        // Format to avoid super long decimals, but keep precision
        const fmt = (n: number) => {
            if (!isFinite(n) || isNaN(n)) return "";
            if (Math.abs(n) < 1e-6) return n.toExponential(4);
            return parseFloat(n.toPrecision(6)).toString();
        };

        // FORMULA: Mass (g) = Conc (M) * Vol (L) * MW (g/mol)

        if (target === 'mass') {
            if (w > 0 && v > 0 && c > 0) {
                const volL = toBase(v, volUnit);
                const concM = toBase(c, concUnit);
                const massG = concM * volL * w;
                const finalMass = fromBase(massG, massUnit);
                // Avoid infinite loop if value hasn't effectively changed
                if (parseFloat(mass) !== parseFloat(fmt(finalMass))) {
                    setMolarityState({ mass: fmt(finalMass) });
                }
            }
        }
        else if (target === 'volume') {
            if (w > 0 && m > 0 && c > 0) {
                const massG = toBase(m, massUnit);
                const concM = toBase(c, concUnit);
                const volL = massG / (concM * w);
                const finalVol = fromBase(volL, volUnit);
                if (parseFloat(volume) !== parseFloat(fmt(finalVol))) {
                    setMolarityState({ volume: fmt(finalVol) });
                }
            }
        }
        else if (target === 'concentration') {
            if (w > 0 && m > 0 && v > 0) {
                const massG = toBase(m, massUnit);
                const volL = toBase(v, volUnit);
                const concM = massG / (volL * w);
                const finalConc = fromBase(concM, concUnit);
                if (parseFloat(concentration) !== parseFloat(fmt(finalConc))) {
                    setMolarityState({ concentration: fmt(finalConc) });
                }
            }
        }
        else if (target === 'mw') {
            if (m > 0 && v > 0 && c > 0) {
                const massG = toBase(m, massUnit);
                const volL = toBase(v, volUnit);
                const concM = toBase(c, concUnit);
                const calcMw = massG / (concM * volL);
                if (calcMw !== mw) {
                    setMolarityState({ mw: parseFloat(fmt(calcMw)) });
                }
            }
        }

    }, [molarityState.mass, molarityState.volume, molarityState.concentration, molarityState.mw, molarityState.target, molarityState.massUnit, molarityState.volUnit, molarityState.concUnit]); // Be careful with dependency array to avoid loops

    // Input Handlers
    const update = (field: string, val: string) => {
        // Find which field is target, don't update it directly unless changing target
        // Actually, we update the state, and the effect runs. 
        // We just need to ensure we don't overwrite the user's input while they type.
        // The effect only runs if the *other* 3 variables change AND valid.
        setMolarityState({ [field]: val });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                    Molarity Calculator
                </h2>
                <p className="text-zinc-500">Solve for Mass, Volume, or Concentration</p>
            </div>

            {/* Quick Lookup */}
            <div className="space-y-4">
                <div className="glass-card p-4 flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (searchTerm) {
                                window.open(`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(searchTerm)}`, '_blank');
                            }
                        }}
                        title="Search on PubChem"
                        className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                        <Search className="h-5 w-5" />
                    </button>
                    <form onSubmit={handleLookup} className="flex-1 flex gap-2">
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search chemical to auto-fill MW..."
                            className="flex-1 bg-transparent border-none text-zinc-200 focus:ring-0 placeholder:text-zinc-600"
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium text-zinc-300 transition-colors"
                        >
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                        </button>
                    </form>
                </div>

                {lookupResult && (
                    <div className="glass-card px-6 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        {lookupResult.cid && (
                            <img src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${lookupResult.cid}/PNG?record_type=2d&image_size=50x50`} className="h-10 w-10 object-contain opacity-80" />
                        )}
                        <div className="text-sm">
                            <span className="text-zinc-400">Calculated for: </span>
                            <span className="text-white font-medium">{lookupResult.name || lookupResult.formula}</span>
                            {lookupResult.formula && <span className="ml-2 text-xs text-zinc-500 font-mono"><FormulaBadge formula={lookupResult.formula} className="inline-block" /></span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Calculator */}
            <div className="glass-card p-6 space-y-6 relative overflow-hidden">
                {/* Visual connection lines could go here */}

                {/* MW Row */}
                <div className={`flex items-center gap-4 p-3 rounded-xl transition-all ${molarityState.target === 'mw' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
                        <Atom className="h-5 w-5" />
                    </div>
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

                {/* Mass Row */}
                <div className={`flex items-center gap-4 p-3 rounded-xl transition-all ${molarityState.target === 'mass' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
                        <Scale className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Mass</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={molarityState.mass}
                                onChange={(e) => update('mass', e.target.value)}
                                disabled={molarityState.target === 'mass'}
                                placeholder="0.00"
                                className={`w-full bg-transparent border-none text-lg font-mono focus:ring-0 p-0 ${molarityState.target === 'mass' ? 'text-emerald-400 font-bold' : 'text-white'}`}
                            />
                            <select
                                value={molarityState.massUnit}
                                onChange={(e) => setMolarityState({ massUnit: e.target.value })}
                                className="bg-transparent border-none text-sm text-zinc-500 focus:ring-0 cursor-pointer hover:text-zinc-300"
                            >
                                <option value="g" className="bg-zinc-900">g</option>
                                <option value="mg" className="bg-zinc-900">mg</option>
                                <option value="μg" className="bg-zinc-900">μg</option>
                                <option value="ng" className="bg-zinc-900">ng</option>
                                <option value="kg" className="bg-zinc-900">kg</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => setMolarityState({ target: 'mass' })}
                        className={`p-2 rounded-lg transition-colors ${molarityState.target === 'mass' ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                        title="Solve for Mass"
                    >
                        <Lock className={`h-4 w-4 ${molarityState.target === 'mass' ? 'fill-current' : ''}`} />
                    </button>
                </div>

                <div className="flex justify-center -my-2 opacity-30">
                    <ArrowRightLeft className="h-4 w-4 text-zinc-500 rotate-90" />
                </div>


                {/* Concentration Row */}
                <div className={`flex items-center gap-4 p-3 rounded-xl transition-all ${molarityState.target === 'concentration' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
                        <Beaker className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Concentration</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={molarityState.concentration}
                                onChange={(e) => update('concentration', e.target.value)}
                                disabled={molarityState.target === 'concentration'}
                                placeholder="0.00"
                                className={`w-full bg-transparent border-none text-lg font-mono focus:ring-0 p-0 ${molarityState.target === 'concentration' ? 'text-emerald-400 font-bold' : 'text-white'}`}
                            />
                            <select
                                value={molarityState.concUnit}
                                onChange={(e) => setMolarityState({ concUnit: e.target.value })}
                                className="bg-transparent border-none text-sm text-zinc-500 focus:ring-0 cursor-pointer hover:text-zinc-300"
                            >
                                <option value="M" className="bg-zinc-900">M</option>
                                <option value="mM" className="bg-zinc-900">mM</option>
                                <option value="μM" className="bg-zinc-900">μM</option>
                                <option value="nM" className="bg-zinc-900">nM</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => setMolarityState({ target: 'concentration' })}
                        className={`p-2 rounded-lg transition-colors ${molarityState.target === 'concentration' ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                        title="Solve for Concentration"
                    >
                        <Lock className={`h-4 w-4 ${molarityState.target === 'concentration' ? 'fill-current' : ''}`} />
                    </button>
                </div>

                {/* Volume Row */}
                <div className={`flex items-center gap-4 p-3 rounded-xl transition-all ${molarityState.target === 'volume' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
                        <Pipette className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Volume</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={molarityState.volume}
                                onChange={(e) => update('volume', e.target.value)}
                                disabled={molarityState.target === 'volume'}
                                placeholder="0.00"
                                className={`w-full bg-transparent border-none text-lg font-mono focus:ring-0 p-0 ${molarityState.target === 'volume' ? 'text-emerald-400 font-bold' : 'text-white'}`}
                            />
                            <select
                                value={molarityState.volUnit}
                                onChange={(e) => setMolarityState({ volUnit: e.target.value })}
                                className="bg-transparent border-none text-sm text-zinc-500 focus:ring-0 cursor-pointer hover:text-zinc-300"
                            >
                                <option value="L" className="bg-zinc-900">L</option>
                                <option value="mL" className="bg-zinc-900">mL</option>
                                <option value="μL" className="bg-zinc-900">μL</option>
                                <option value="nL" className="bg-zinc-900">nL</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => setMolarityState({ target: 'volume' })}
                        className={`p-2 rounded-lg transition-colors ${molarityState.target === 'volume' ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                        title="Solve for Volume"
                    >
                        <Lock className={`h-4 w-4 ${molarityState.target === 'volume' ? 'fill-current' : ''}`} />
                    </button>
                </div>

            </div>


        </div>
    );
}
