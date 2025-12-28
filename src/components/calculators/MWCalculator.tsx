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
                const result = { ...res, composition: comp };
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
        <div className="space-y-6">
            <section className="glass-card">
                <form onSubmit={handleCalculate} className="space-y-4">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                <Search className="h-4 w-4" />
                            </span>
                            <input
                                type="text"
                                value={mwInput}
                                onChange={(e) => setMwInput(e.target.value)}
                                placeholder="Enter chemical name (e.g. Aspirin) or formula (e.g. H2O)..."
                                className="w-full pl-10"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="primary flex items-center gap-2 min-w-[120px] justify-center"
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
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Result Summary */}
                    <section className="glass-card flex flex-col items-center justify-center py-10 text-center">
                        <span className="text-sm font-medium uppercase tracking-widest text-zinc-500">Molecular Weight</span>
                        <div className="mt-2 text-6xl font-black text-white">
                            {mwResult.mw.toFixed(2)}
                            <span className="ml-2 text-xl font-normal text-zinc-500">g/mol</span>
                        </div>
                        <div className="mt-4">
                            <FormulaBadge formula={mwResult.formula} className="text-base px-4 py-1" />
                        </div>
                        {mwResult.name && (
                            <p className="mt-4 text-lg font-medium text-zinc-300">{mwResult.name}</p>
                        )}
                    </section>

                    {/* Visualization or Details */}
                    <section className="glass-card overflow-hidden">
                        <div className="flex h-full items-center justify-center p-4">
                            {mwResult.cid ? (
                                <img
                                    src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${mwResult.cid}/PNG`}
                                    alt={mwResult.name || mwResult.formula}
                                    className="max-h-64 object-contain brightness-110 contrast-125"
                                />
                            ) : (
                                <div className="text-center text-zinc-500 italic">
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
