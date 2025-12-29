"use client";

import { useState } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { parseFormula, calculateMw } from "@/lib/parser";
import { lookupPubChem } from "@/lib/api";
import { FormulaBadge } from "../ui/FormulaBadge";

export default function MWCalculator() {
    const { mwInput, setMwInput, mwResult, setMwResult, addToHistory } = useStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCalculate = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!mwInput.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Try local parse first
            if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(mwInput) && /[A-Z]/.test(mwInput)) {
                try {
                    const comp = parseFormula(mwInput);
                    const mw = calculateMw(comp);
                    const result = {
                        mw,
                        formula: mwInput,
                        composition: comp,
                    };
                    setMwResult(result as any);
                    addToHistory(result as any);
                    setLoading(false);
                    return;
                } catch (e) { }
            }

            // 2. Try PubChem
            const res = await lookupPubChem(mwInput);
            if (res) {
                const comp = parseFormula(res.formula!);
                // Create a clean, serializable object
                const result = {
                    mw: Number(res.mw),
                    formula: String(res.formula),
                    name: res.name ? String(res.name) : undefined,
                    cid: res.cid ? Number(res.cid) : undefined,
                    composition: comp
                };
                setMwResult(result as any);
                addToHistory(result as any);
            } else {
                setError("Could not find chemical or parse formula.");
            }
        } catch (err) {
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
                    <section className="glass-card overflow-hidden">
                        <div className="flex h-full min-h-[200px] items-center justify-center p-4">
                            {mwResult.cid ? (
                                <img
                                    src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${mwResult.cid}/PNG`}
                                    alt={mwResult.name || mwResult.formula}
                                    className="max-h-48 sm:max-h-64 object-contain brightness-110 contrast-125"
                                />
                            ) : (
                                <div className="text-center text-zinc-500 italic text-sm">
                                    No 2D structure available for manual formula input.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
