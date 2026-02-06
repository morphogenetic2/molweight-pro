"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { parseFormula, calculateMw, ChemicalData, normalizeFormula, tryCalculateMw } from "@/lib/parser";
import { lookupPubChem } from "@/lib/api";
import { FormulaBadge } from "../ui/FormulaBadge";
import Image from "next/image";
import Molecule3D from "../ui/Molecule3D";
import { useDebounce } from "@/lib/hooks/useDebounce";

export default function MWCalculator() {
    const { mwInput, setMwInput, mwResult, setMwResult, addToHistory } = useStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

    const debouncedInput = useDebounce(mwInput, 600);

    // Auto-calculate for local formulas on-the-fly
    useEffect(() => {
        const query = debouncedInput.trim();
        if (!query) return;

        // Try local advanced parser
        const localResult = tryCalculateMw(query);
        if (localResult) {
            const result: ChemicalData = {
                mw: localResult.mw,
                formula: localResult.formula,
                composition: parseFormula(query),
            };
            setMwResult(result);
            // Don't add to history automatically on every keystroke to avoid clutter,
            // only when they actually type something complete or click calculate.
            // But let's show the result immediately.
        }
    }, [debouncedInput, setMwResult]);

    const handleCalculate = async (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        const query = mwInput.trim();
        if (!query) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Try local parse first
            const localResult = tryCalculateMw(query);
            if (localResult) {
                const comp = parseFormula(query);
                const result: ChemicalData = {
                    mw: localResult.mw,
                    formula: localResult.formula,
                    composition: comp,
                };
                setMwResult(result);
                addToHistory(result);
                setLoading(false);
                return;
            }

            // 2. Try PubChem
            const res = await lookupPubChem(mwInput);
            if (res) {
                const comp = parseFormula(res.formula!);
                // Create a clean, serializable object
                const result: ChemicalData = {
                    mw: Number(res.mw),
                    formula: normalizeFormula(res.formula!),
                    name: res.name ? String(res.name) : undefined,
                    cid: res.cid ? Number(res.cid) : undefined,
                    composition: comp
                };
                setMwResult(result);
                addToHistory(result);
            } else {
                setError("Could not find chemical or parse formula.");
            }
        } catch {
            setError("An error occurred during calculation.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            <section className="glass-card !p-4 sm:!p-6">
                <form onSubmit={handleCalculate} className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex gap-2 flex-1">
                            <button
                                type="button"
                                title="View on PubChem"
                                aria-label="View on PubChem"
                                onClick={() => {
                                    if (mwInput.trim()) {
                                        window.open(`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(mwInput.trim())}`, "_blank");
                                    }
                                }}
                                className="shrink-0 p-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                            <div className="relative flex-1 group">
                                <input
                                    type="text"
                                    value={mwInput}
                                    onChange={(e) => setMwInput(e.target.value)}
                                    placeholder="Enter formula or name..."
                                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-lg px-3 py-2 transition-all outline-none text-sm sm:text-base"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="primary flex items-center gap-2 w-full sm:min-w-[120px] sm:w-auto justify-center"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate"}
                        </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">Tip: formulas like <span className="font-mono text-zinc-400">CuSO4·5H2O</span> work too.</p>
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}
                </form>
            </section>

            {mwResult && (
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    {/* Result Summary */}
                    <section className="glass-card flex flex-col items-center justify-center py-6 sm:py-10 text-center">
                        <span className="text-[10px] sm:text-sm font-medium uppercase tracking-widest text-zinc-500">Molecular Weight</span>
                        <div className="mt-2 text-4xl sm:text-5xl lg:text-6xl font-black text-white">
                            {mwResult.mw.toFixed(2)}
                            <span className="ml-2 text-lg sm:text-xl font-normal text-zinc-500">g/mol</span>
                        </div>
                        <div className="mt-4">
                            <FormulaBadge formula={mwResult.formula} className="text-sm sm:text-base px-3 sm:px-4 py-1" />
                        </div>
                        {mwResult.name && (
                            <p className="mt-4 text-base sm:text-lg font-medium text-zinc-300 px-4">{mwResult.name}</p>
                        )}
                    </section>

                    {/* Visualization or Details */}
                    <section className="glass-card overflow-hidden relative group min-h-[300px] flex flex-col">
                        {mwResult.cid && (
                            <div className="absolute top-4 right-4 z-10 flex gap-1 p-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button
                                    onClick={() => setViewMode('2d')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                        viewMode === '2d' 
                                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' 
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    2D
                                </button>
                                <button
                                    onClick={() => setViewMode('3d')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                        viewMode === '3d' 
                                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' 
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    3D
                                </button>
                            </div>
                        )}
                        <div className="flex-1 flex items-center justify-center p-4">
                            {mwResult.cid ? (
                                viewMode === '2d' ? (
                                    <Image
                                        src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${mwResult.cid}/PNG`}
                                        alt={mwResult.name || mwResult.formula}
                                        width={256}
                                        height={256}
                                        className="max-h-48 sm:max-h-64 w-auto object-contain brightness-110 contrast-125 transition-all duration-500 animate-in fade-in zoom-in-95"
                                    />
                                ) : (
                                    <Molecule3D cid={mwResult.cid} />
                                )
                            ) : (
                                <div className="text-center text-zinc-500 italic text-sm">
                                    No structure available for manual formula input.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
