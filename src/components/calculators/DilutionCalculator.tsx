import { useStore } from "@/store/useStore";
import { formatMass, formatVolume, formatConcentration, parseFormula, calculateMw, getUnitLabel } from "@/lib/parser";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Info, Plus, Check, ArrowRightLeft } from "lucide-react";
import { lookupPubChem } from "@/lib/api";
import { FormulaBadge } from "../ui/FormulaBadge";
import { useState, useEffect } from "react";

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function DilutionCalculator() {
    const {
        dilution, setDilution,
        bufferVolume, bufferUnit, solutes, addSolute, updateSolute,
        setBufferVolume, setBufferUnit
    } = useStore();
    const [isSearching, setIsSearching] = useState(false);
    const [showVolumeWarning, setShowVolumeWarning] = useState(false);

    // Track the ID of the solute we just added (PERSISTED in store now)
    const linkedSoluteId = dilution.linkedSoluteId;

    // Derived state: Check status of the added solute
    const addedSolute = solutes.find(s => s.id === linkedSoluteId);

    // Check if the current dilution state matches the saved solute
    const isDirty = addedSolute ? (
        addedSolute.conc !== dilution.c2 ||
        addedSolute.unit !== dilution.u2 ||
        addedSolute.stockConc !== dilution.c1 ||
        addedSolute.stockUnit !== dilution.u1 ||
        addedSolute.name !== dilution.name
    ) : false;

    // Button State: 
    // - "add": Not added yet, or added but then removed from list
    // - "added": Added and matches current state
    // - "update": Added but current state is different (dirty)
    const buttonState = !addedSolute ? "add" : (isDirty ? "update" : "added");

    const handleAddOrUpdate = () => {
        if (buttonState === "add") {
            // Generate ID locally so we can track it
            const newId = Math.random().toString(36).substr(2, 9);
            addSolute({
                id: newId,
                name: dilution.name,
                mw: dilution.mw > 0 ? dilution.mw.toString() : "",
                conc: dilution.c2,
                unit: dilution.u2,
                isStock: true,
                stockConc: dilution.c1,
                stockUnit: dilution.u1
            });
            // Persist the link
            setDilution({ linkedSoluteId: newId });
        } else if (buttonState === "update" && linkedSoluteId) {
            updateSolute(linkedSoluteId, {
                name: dilution.name,
                mw: dilution.mw > 0 ? dilution.mw.toString() : "",
                conc: dilution.c2,
                unit: dilution.u2,
                stockConc: dilution.c1,
                stockUnit: dilution.u1
            });
        }
    };

    const debouncedName = useDebounce(dilution.name, 600);

    useEffect(() => {
        const triggerLookup = async () => {
            const query = debouncedName.trim();
            if (!query) return;

            setIsSearching(true);
            try {
                // 1. Try local parse
                if (/^[A-Za-z0-9()\[\]·*•.]+$/.test(query) && /[A-Z]/.test(query)) {
                    try {
                        const composition = parseFormula(query);
                        const mw = calculateMw(composition);
                        setDilution({ mw });
                        setIsSearching(false);
                        return;
                    } catch (e) { }
                }

                // 2. Try PubChem
                const res = await lookupPubChem(query);
                if (res && res.mw) {
                    // Only store serializable primitive values
                    setDilution({
                        mw: Number(res.mw),
                    });
                }
            } catch (err) {
                console.error("Lookup error:", err);
            } finally {
                setIsSearching(false);
            }
        };

        triggerLookup();
    }, [debouncedName, setDilution]);

    // Helper: isMolar checks if unit is M, mM, or μM
    const isMolar = (u: string) => ['M', 'mM', 'μM'].includes(u);
    // Helper: isMass checks if unit is μg/mL, mg/mL, mg/L, g/L, pct, ng/μL
    const isMass = (u: string) => ['μg/mL', 'mg/mL', 'mg/L', 'g/L', 'pct', 'ng/μL'].includes(u);

    // Advanced calculation logic (matching prototype C1V1 = C2V2)
    const calculateDilution = () => {
        const c1 = parseFloat(dilution.c1);
        const u1 = dilution.u1;
        const c2 = parseFloat(dilution.c2);
        const u2 = dilution.u2;
        const v2 = parseFloat(dilution.v2);
        const uv2 = dilution.vu2;
        const mw = dilution.mw;

        if (isNaN(c1) || isNaN(c2) || isNaN(v2) || c1 <= 0) return null;

        // Domain check: Need MW if crossing Mass <-> Molar
        const domain1 = isMolar(u1) ? 'molar' : (isMass(u1) ? 'mass' : null);
        const domain2 = isMolar(u2) ? 'molar' : (isMass(u2) ? 'mass' : null);

        if (domain1 !== domain2 && (!mw || mw <= 0)) {
            return { error: "Molecular Weight required for Mass <-> Molar conversion." };
        }

        // 1. Convert to base units
        // Molar -> M. Mass -> g/L.
        let c1Base = c1;
        if (u1 === 'mM') c1Base = c1 / 1000;
        else if (u1 === 'μM') c1Base = c1 / 1e6;
        else if (u1 === 'μg/mL' || u1 === 'ng/μL') c1Base = c1 / 1000;
        else if (u1 === 'mg/L') c1Base = c1 / 1000;
        else if (u1 === 'pct') c1Base = c1 * 10;

        let c2Base = c2;
        if (u2 === 'mM') c2Base = c2 / 1000;
        else if (u2 === 'μM') c2Base = c2 / 1e6;
        else if (u2 === 'μg/mL' || u2 === 'ng/μL') c2Base = c2 / 1000;
        else if (u2 === 'mg/L') c2Base = c2 / 1000;
        else if (u2 === 'pct') c2Base = c2 * 10;

        // 2. Cross Domains? (Normalize to domain 2)
        if (domain2 === 'molar' && domain1 === 'mass') {
            c1Base = c1Base / mw; // g/L -> M
        } else if (domain2 === 'mass' && domain1 === 'molar') {
            c1Base = c1Base * mw; // M -> g/L
        }

        // 3. V2 to Liters
        let v2L = v2;
        if (uv2 === 'mL') v2L = v2 / 1000;
        if (uv2 === 'μL') v2L = v2 / 1e6;

        const v1L = (c2Base * v2L) / c1Base;

        if (!isFinite(v1L) || v1L <= 0) return null;
        if (v1L > v2L) return { error: "Impossible: Stock concentration is lower than target." };

        return { v1: v1L, solvent: v2L - v1L };
    };

    const handleExternalLookup = () => {
        const query = dilution.name.trim();
        if (!query) return;

        // If we have a CID (from isSearching useEffect), we can link directly
        // Currently the store doesn't save CID for dilution, but we can search by name
        const url = `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(query)}`;
        window.open(url, "_blank");
    };

    const results = calculateDilution();

    return (
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8 pb-10">
            {/* Chemical Info Header */}
            <section className="glass-card flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 !py-4">
                <div className="w-full sm:flex-1">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2">Chemical Component</label>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleExternalLookup}
                            title="View on PubChem"
                            className="shrink-0 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <div className="relative flex-1 group">
                            <input
                                type="text"
                                placeholder="Chemical Name or Formula"
                                className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-lg px-3 py-2 transition-all outline-none text-sm"
                                value={dilution.name}
                                onChange={(e) => setDilution({ name: e.target.value })}
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="w-full sm:w-40">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2">Molecular Weight</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            placeholder="Mw"
                            className="w-full text-sm"
                            value={dilution.mw || ""}
                            onChange={(e) => setDilution({ mw: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-zinc-500 text-[10px] sm:text-xs font-mono shrink-0">g/mol</span>
                    </div>
                </div>
            </section>

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                {/* Stock Solution */}
                <section className="glass-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4 text-indigo-400">Stock Solution (C1)</h3>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Conc"
                                className="flex-1 text-sm"
                                value={dilution.c1}
                                onChange={(e) => setDilution({ c1: e.target.value })}
                            />
                            <select
                                className="w-24 sm:w-32 text-xs sm:text-sm"
                                value={dilution.u1}
                                onChange={(e) => setDilution({ u1: e.target.value })}
                            >
                                <option value="M">M</option>
                                <option value="mM">mM</option>
                                <option value="μM">μM</option>
                                <option value="μg/mL">μg/mL</option>
                                <option value="ng/μL">ng/μL</option>
                                <option value="mg/mL">mg/mL</option>
                                <option value="mg/L">mg/L</option>
                                <option value="g/L">g/L</option>
                                <option value="pct">% (w/v)</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Target Solution */}
                <section className="glass-card border-indigo-500/20">
                    <h3 className="text-base sm:text-lg font-semibold mb-4 text-emerald-400">Target Solution (C2, V2)</h3>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Target Conc (C2)"
                                className="flex-1 text-sm"
                                value={dilution.c2}
                                onChange={(e) => setDilution({ c2: e.target.value })}
                            />
                            <select
                                className="w-24 sm:w-32 text-xs sm:text-sm"
                                value={dilution.u2}
                                onChange={(e) => setDilution({ u2: e.target.value })}
                            >
                                <option value="M">M</option>
                                <option value="mM">mM</option>
                                <option value="μM">μM</option>
                                <option value="μg/mL">μg/mL</option>
                                <option value="ng/μL">ng/μL</option>
                                <option value="mg/mL">mg/mL</option>
                                <option value="mg/L">mg/L</option>
                                <option value="g/L">g/L</option>
                                <option value="pct">% (w/v)</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Final Vol (V2)"
                                className="flex-1 text-sm"
                                value={dilution.v2}
                                onChange={(e) => setDilution({ v2: e.target.value })}
                            />
                            <select
                                className="w-20 sm:w-24 text-xs sm:text-sm"
                                value={dilution.vu2}
                                onChange={(e) => setDilution({ vu2: e.target.value })}
                            >
                                <option>mL</option>
                                <option>μL</option>
                                <option>L</option>
                            </select>
                        </div>
                    </div>

                    {/* Integration Buttons */}
                    <div className="mt-6 flex flex-col gap-2 items-stretch sm:items-start">
                        <button
                            type="button"
                            disabled={solutes.length === 0}
                            onClick={() => setDilution({ v2: bufferVolume, vu2: bufferUnit })}
                            className="text-[10px] sm:text-xs py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center sm:justify-start gap-2"
                        >
                            <Info className="h-3 w-3 shrink-0" />
                            Get Volume from recipe builder
                        </button>
                        {showVolumeWarning ? (
                            <div className="flex flex-col gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl w-full sm:max-w-sm">
                                <p className="text-[10px] sm:text-xs text-amber-200 leading-relaxed">
                                    The volume of the buffer recipe ({bufferVolume} {getUnitLabel(bufferUnit)}) is different from this dilution ({dilution.v2} {getUnitLabel(dilution.vu2)}). Update the buffer volume to match?
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setBufferVolume(dilution.v2);
                                            setBufferUnit(dilution.vu2);
                                            handleAddOrUpdate();
                                            setShowVolumeWarning(false);
                                        }}
                                        className="flex-1 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-[10px] sm:text-xs font-bold text-emerald-400 transition-all font-mono"
                                    >
                                        YES
                                    </button>
                                    <button
                                        onClick={() => setShowVolumeWarning(false)}
                                        className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] sm:text-xs font-bold text-zinc-400 transition-all"
                                    >
                                        NO
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (buttonState === "add" && (dilution.v2 !== bufferVolume || dilution.vu2 !== bufferUnit)) {
                                        setShowVolumeWarning(true);
                                    } else {
                                        handleAddOrUpdate();
                                    }
                                }}
                                className={`text-[10px] sm:text-xs py-2 px-3 border rounded-lg transition-all flex items-center justify-center sm:justify-start gap-2 ${buttonState === "added"
                                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                    : buttonState === "update"
                                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                                        : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-400 hover:text-indigo-300'
                                    }`}
                            >
                                {buttonState === "added" && (
                                    <>
                                        <Check className="h-4 w-4 shrink-0" /> Added to Recipe
                                    </>
                                )}
                                {buttonState === "update" && (
                                    <>
                                        <ArrowRightLeft className="h-4 w-4 shrink-0" /> Update Recipe
                                    </>
                                )}
                                {buttonState === "add" && (
                                    <>
                                        <Plus className="h-4 w-4 shrink-0" /> Add to buffer recipe
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </section>
            </div>

            <AnimatePresence mode="wait">
                {results && ('error' in results ? (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card border-red-500/20 bg-red-500/[0.02] flex items-center gap-3 text-red-400 text-sm"
                    >
                        <Info className="h-5 w-5 shrink-0" />
                        {results.error}
                    </motion.div>
                ) : (
                    <motion.section
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card overflow-hidden border-indigo-500/30 !p-0"
                    >
                        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                            <div className="p-6 sm:p-8 text-center">
                                <p className="text-zinc-500 text-[10px] sm:text-sm uppercase tracking-widest font-bold mb-2">Volume of Stock (V1)</p>
                                <p className="text-3xl sm:text-4xl font-black text-indigo-400 font-mono">
                                    {formatVolume(results.v1)}
                                </p>
                            </div>
                            <div className="p-6 sm:p-8 text-center">
                                <p className="text-zinc-500 text-[10px] sm:text-sm uppercase tracking-widest font-bold mb-2">Volume of Solvent</p>
                                <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                                    {formatVolume(results.solvent)}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white/5 px-4 sm:px-6 py-4 text-center text-[10px] sm:text-sm text-zinc-400 italic">
                            Instructions: Take {formatVolume(results.v1)} of stock (at {formatConcentration(dilution.c1, dilution.u1)} {getUnitLabel(dilution.u1)}) and add solvent until reaching {dilution.v2} {getUnitLabel(dilution.vu2)} final volume.
                        </div>
                    </motion.section>
                ))}
            </AnimatePresence>
        </div>
    );
}
