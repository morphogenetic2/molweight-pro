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

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Search, Loader2, AlertCircle, Download } from "@/lib/icons";
import { useStore } from "@/store/useStore";
import { parseFormula, ChemicalData, normalizeFormula, tryCalculateMw } from "@/lib/parser";
import { lookupPubChem, lookupPubChemByFormula } from "@/lib/api";
import { FormulaBadge } from "../ui/FormulaBadge";
import Molecule2D from "../ui/Molecule2D";
import Molecule3D from "../ui/Molecule3D";
import { useDebounce } from "@/lib/hooks/useDebounce";

function hasHydrateWater(formula: string): boolean {
    // Matches hydrate separators + optional multiplier + H2O
    // Examples: CuSO4|5H2O, CuSO4·5H2O, CuSO4*5H2O
    return /(^|[|·*•.])\s*\d*\.?\d*\s*H2O(?:$|[|·*•.])/i.test(formula);
}

function addExplicitHydrateWaters(smiles: string): string {
    // PubChem often represents free waters in hydrates as disconnected "O" or "[OH2]"
    // fragments. Convert those to bonded H-O-H so the renderer draws explicit atoms/bonds.
    return smiles
        .split(".")
        .map((fragment) => {
            if (fragment === "O" || fragment === "[OH2]") {
                return "[H]O([H])";
            }
            return fragment;
        })
        .join(".");
}

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
    const { mwInput, setMwInput, mwResult, setMwResult, addToHistory, moleculeSettings } = useStore();
    const [loading, setLoading] = useState(false);
    const [isSearchingStructure, setIsSearchingStructure] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
    const [imageLoading, setImageLoading] = useState(false);
    const requestSeqRef = useRef(0);
    const maxRenderSize = Math.min(400, moleculeSettings.maxRenderSize ?? 320);

    const debouncedInput = useDebounce(mwInput, 500);
    const hydrateWaterInFormula = mwResult ? hasHydrateWater(mwResult.formula) : false;
    const hydratedSmiles =
        mwResult?.smiles && hydrateWaterInFormula
            ? addExplicitHydrateWaters(mwResult.smiles)
            : mwResult?.smiles;

    const runLookup = useCallback(
        async (rawQuery: string, options: { addHistory: boolean; showErrors: boolean }) => {
            const query = rawQuery.trim();
            if (!query) return;

            const requestSeq = ++requestSeqRef.current;
            setLoading(true);
            setIsSearchingStructure(true);
            setError(null);

            try {
                // Attempt 1: Local formula parsing (fast, offline-capable)
                const localResult = tryCalculateMw(query);
                if (localResult) {
                    const comp = parseFormula(query);

                    // Fetch CID and SMILES for 2D/3D structure visualization
                    const pubchemData = await lookupPubChemByFormula(query);
                    if (requestSeq !== requestSeqRef.current) return;

                    const result: ChemicalData = {
                        mw: localResult.mw,
                        formula: localResult.formula,
                        composition: comp,
                        cid: pubchemData?.cid || undefined,
                        smiles: pubchemData?.smiles || undefined,
                    };
                    setMwResult(result);
                    if (options.addHistory) {
                        addToHistory(result);
                    }
                    return;
                }

                // Attempt 2: PubChem API lookup (slower, requires network)
                const res = await lookupPubChem(query);
                if (requestSeq !== requestSeqRef.current) return;

                if (res) {
                    const comp = parseFormula(res.formula!);
                    const result: ChemicalData = {
                        mw: Number(res.mw),
                        formula: normalizeFormula(res.formula!),
                        name: res.name ? String(res.name) : undefined,
                        cid: res.cid ? Number(res.cid) : undefined,
                        smiles: res.smiles,
                        composition: comp
                    };
                    setMwResult(result);
                    if (options.addHistory) {
                        addToHistory(result);
                    }
                } else if (options.showErrors) {
                    setError("Could not find chemical or parse formula.");
                }
            } catch (err) {
                if (requestSeq === requestSeqRef.current && options.showErrors) {
                    setError("An error occurred during calculation.");
                }
                console.error("MW calculation error:", err);
            } finally {
                if (requestSeq === requestSeqRef.current) {
                    setLoading(false);
                    setIsSearchingStructure(false);
                }
            }
        },
        [addToHistory, setMwResult]
    );

    // Auto-lookup after 500ms idle typing
    useEffect(() => {
        const query = debouncedInput.trim();
        if (!query) return;
        void runLookup(query, { addHistory: false, showErrors: false });
    }, [debouncedInput, runLookup]);

    useEffect(() => {
        if (viewMode === "2d" && mwResult?.cid && !hydratedSmiles) {
            setImageLoading(true);
        }
    }, [viewMode, mwResult?.cid, hydratedSmiles]);

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
        await runLookup(mwInput, { addHistory: true, showErrors: true });
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
                                className="shrink-0 p-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                            <div className="relative flex-1 group">
                                <input
                                    type="text"
                                    value={mwInput}
                                    onChange={(e) => setMwInput(e.target.value)}
                                    placeholder="Enter formula or name..."
                                    className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 transition-all outline-none text-sm sm:text-base"
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
                    <p className="text-[11px] text-zinc-500">
                        Tip: formulas like <span className="font-mono text-zinc-400">CuSO4·5H2O</span> work too.
                    </p>
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
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
                                            : 'text-zinc-400 hover:text-zinc-200'
                                        }`}
                                    >
                                        2D
                                    </button>
                                    <button
                                        onClick={() => setViewMode('3d')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                            viewMode === '3d' 
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
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
                                        className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all opacity-0 group-hover:opacity-100 duration-300"
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
                                        {/* Loading state for image file specifically */}
                                        {imageLoading && !isSearchingStructure && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                                            </div>
                                        )}

                                        {/* Structure Rendering Logic */}
                                        {hydratedSmiles ? (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Molecule2D 
                                                    key={hydratedSmiles}
                                                    smiles={hydratedSmiles}
                                                    width={maxRenderSize}
                                                    height={maxRenderSize}
                                                    forceExplicitHydrogens={hydrateWaterInFormula}
                                                />
                                            </div>
                                        ) : mwResult.cid ? (
                                            <div className="w-full h-full flex items-center justify-center relative">
                                                {imageLoading && !isSearchingStructure && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 z-10">
                                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                                                    </div>
                                                )}
                                                <Image
                                                    src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${mwResult.cid}/PNG`}
                                                    alt={`2D structure of ${mwResult.name || mwResult.formula}`}
                                                    width={maxRenderSize}
                                                    height={maxRenderSize}
                                                    className={`max-h-48 sm:max-h-64 object-contain brightness-110 contrast-125 transition-opacity ${imageLoading || isSearchingStructure ? 'opacity-0' : 'opacity-100'}`}
                                                    onLoad={() => setImageLoading(false)}
                                                    onError={() => setImageLoading(false)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-center text-zinc-500 italic text-sm px-4">
                                                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                                                No structure data available locally or from PubChem.
                                                <br />
                                                <span className="text-[10px] mt-2 block">(Try searching by chemical name for better structural data)</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <Molecule3D cid={mwResult.cid} />
                                )
                            ) : (
                                <div className="text-center text-zinc-500 italic text-sm px-4">
                                    {isSearchingStructure ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-10 w-10 animate-spin text-emerald-500/50" />
                                            <p className="animate-pulse">Fetching structure from PubChem...</p>
                                        </div>
                                    ) : (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
