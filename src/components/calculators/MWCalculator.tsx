/**
 * @file MWCalculator.tsx
 * @description Molecular Weight Calculator component with PubChem integration
 * and 2D structure visualization. Supports both formula parsing and chemical
 * name lookup.
 * @module components/calculators
 * @version 1.0.0
 * @since 2025-01-01
 */

"use client";

import { useState } from "react";
import { Search, Loader2, AlertCircle, Download } from "lucide-react";
import { useStore } from "@/store/useStore";
import { parseFormula, calculateMw } from "@/lib/parser";
import { lookupPubChem, lookupPubChemByFormula } from "@/lib/api";
import { FormulaBadge } from "../ui/FormulaBadge";

/**
 * Molecular Weight Calculator Component
 *
 * Allows users to calculate molecular weights by entering chemical formulas
 * or common names. Attempts local parsing first, then falls back to PubChem API.
 * Displays 2D molecular structure when available from PubChem.
 *
 * @component
 * @returns {JSX.Element} Calculator UI with input, results, and 2D structure display
 *
 * @example
 * <MWCalculator />
 *
 * @since 1.0.0
 */
export default function MWCalculator() {
    const { mwInput, setMwInput, mwResult, setMwResult, addToHistory } = useStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);

    /**
     * Handles form submission for molecular weight calculation.
     *
     * Flow:
     * 1. Validates input is non-empty
     * 2. Attempts local formula parsing
     * 3. Falls back to PubChem API if local parsing fails
     * 4. Updates store with result and adds to history
     * 5. Displays user-friendly error on failure
     *
     * @async
     * @param {React.FormEvent} [e] - Optional form event (for preventDefault)
     * @returns {Promise<void>}
     */
    const handleCalculate = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!mwInput.trim()) return;

        setLoading(true);
        setError(null);
        setImageError(false);

        try {
            // Attempt 1: Local formula parsing (fast, offline-capable)
            if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(mwInput) && /[A-Z]/.test(mwInput)) {
                try {
                    const comp = parseFormula(mwInput);
                    const mw = calculateMw(comp);

                    // Fetch CID for 2D structure visualization
                    const cid = await lookupPubChemByFormula(mwInput);

                    const result = {
                        mw,
                        formula: mwInput,
                        composition: comp,
                        cid: cid || undefined,
                    };
                    setMwResult(result as any);
                    addToHistory(result as any);
                    setLoading(false);
                    return;
                } catch (e) {
                    // Local parse failed, continue to PubChem
                }
            }

            // Attempt 2: PubChem API lookup (slower, requires network)
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
            console.error("MW calculation error:", err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Downloads the 2D structure image from PubChem.
     *
     * @param {number} cid - PubChem Compound ID
     * @param {string} filename - Filename for the downloaded image
     */
    const handleDownloadImage = (cid: number, filename: string) => {
        const imageUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

                    {/* 2D Structure Visualization */}
                    <section className="glass-card overflow-hidden relative">
                        <div className="flex h-full min-h-[200px] items-center justify-center p-4">
                            {mwResult.cid ? (
                                <>
                                    {/* Download button */}
                                    <button
                                        onClick={() => handleDownloadImage(mwResult.cid!, mwResult.name || mwResult.formula)}
                                        className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all z-10"
                                        title="Download structure image"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>

                                    {/* Loading state for image */}
                                    {imageLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                                        </div>
                                    )}

                                    {/* Image error state */}
                                    {imageError ? (
                                        <div className="text-center text-zinc-500 italic text-sm px-4">
                                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                                            Failed to load 2D structure image.
                                            <br />
                                            <a
                                                href={`https://pubchem.ncbi.nlm.nih.gov/compound/${mwResult.cid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:text-indigo-300 underline mt-2 inline-block"
                                            >
                                                View on PubChem
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${mwResult.cid}/PNG`}
                                            alt={`2D structure of ${mwResult.name || mwResult.formula}`}
                                            className={`max-h-48 sm:max-h-64 object-contain brightness-110 contrast-125 transition-opacity ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                            onLoadStart={() => setImageLoading(true)}
                                            onLoad={() => setImageLoading(false)}
                                            onError={() => {
                                                setImageLoading(false);
                                                setImageError(true);
                                            }}
                                        />
                                    )}
                                </>
                            ) : (
                                <div className="text-center text-zinc-500 italic text-sm px-4">
                                    <div className="text-zinc-600 mb-2">
                                        <svg className="h-16 w-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    No 2D structure available for manual formula input.
                                    <br />
                                    <span className="text-zinc-600 text-xs mt-1 inline-block">
                                        Try searching by chemical name to see the structure.
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
