/**
 * @file MWCalculator.tsx
 * @description Molecular Weight Calculator component with PubChem integration,
 * 2D/3D structure visualization, and auto-calculation. Supports both formula
 * parsing and chemical name lookup.
 * @module components/calculators
 * @version 1.0.0
 * @since 2025-01-01
 */

"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, Download } from "lucide-react";
import { useStore } from "@/store/useStore";
import { parseFormula, calculateMw, ChemicalData, normalizeFormula, tryCalculateMw } from "@/lib/parser";
import { lookupPubChem, lookupPubChemByFormula } from "@/lib/api";
import { FormulaBadge } from "../ui/FormulaBadge";
import Image from "next/image";
import Molecule3D from "../ui/Molecule3D";
import { useDebounce } from "@/lib/hooks/useDebounce";

/**
 * Molecular Weight Calculator Component
 *
 * Allows users to calculate molecular weights by entering chemical formulas
 * or common names. Attempts local parsing first, then falls back to PubChem API.
 * Displays 2D and 3D molecular structures when available from PubChem.
 * Features auto-calculation for valid formulas and structure image download.
 *
 * @component
 * @returns {JSX.Element} Calculator UI with input, results, and 2D/3D structure display
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
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);

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
            // Don't add to history automatically on every keystroke to avoid clutter
        }
    }, [debouncedInput, setMwResult]);

    /**
     * Handles form submission for molecular weight calculation.
     *
     * Flow:
     * 1. Validates input is non-empty
     * 2. Attempts local formula parsing with CID lookup for 2D structure
     * 3. Falls back to PubChem API if local parsing fails
     * 4. Updates store with result and adds to history
     * 5. Displays user-friendly error on failure
     *
     * @async
     * @param {React.FormEvent} [e] - Optional form event (for preventDefault)
     * @returns {Promise<void>}
     */
    const handleCalculate = async (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        const query = mwInput.trim();
        if (!query) return;

        setLoading(true);
        setError(null);
        setImageError(false);

        try {
            // Attempt 1: Local formula parsing (fast, offline-capable)
            const localResult = tryCalculateMw(query);
            if (localResult) {
                const comp = parseFormula(query);
                
                // Fetch CID for 2D/3D structure visualization
                const cid = await lookupPubChemByFormula(query);
                
                const result: ChemicalData = {
                    mw: localResult.mw,
                    formula: localResult.formula,
                    composition: comp,
                    cid: cid || undefined,
                };
                setMwResult(result);
                addToHistory(result);
                setLoading(false);
                return;
            }

            // Attempt 2: PubChem API lookup (slower, requires network)
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

                    {/* 2D/3D Structure Visualization */}
                    <section className="glass-card overflow-hidden relative group min-h-[300px] flex flex-col">
                        {mwResult.cid && (
                            <>
                                {/* View mode toggle */}
                                <div className="absolute top-4 left-4 z-10 flex gap-1 p-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
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

                                {/* Download button (only for 2D view) */}
                                {viewMode === '2d' && (
                                    <button
                                        onClick={() => handleDownloadImage(mwResult.cid!, mwResult.name || mwResult.formula)}
                                        className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all opacity-0 group-hover:opacity-100 duration-300"
                                        title="Download structure image"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                )}
                            </>
                        )}

                        <div className="flex-1 flex items-center justify-center p-4">
                            {mwResult.cid ? (
                                viewMode === '2d' ? (
                                    <>
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
                                    <Molecule3D cid={mwResult.cid} />
                                )
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
