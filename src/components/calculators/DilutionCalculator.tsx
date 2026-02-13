import { useStore } from "@/store/useStore";
import { formatVolume, formatConcentration, getUnitLabel, tryCalculateMw } from "@/lib/parser";
import { convertUnitValue, parseValueWithUnit } from "@/lib/chemistry/units";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Info, Plus, Check, ArrowRightLeft, Beaker } from "lucide-react";
import { lookupPubChem } from "@/lib/api";
import { useState, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { ValueUnitInput } from "@/components/ui/ValueUnitInput";
import { useToastStore } from "@/store/useToastStore";
import { FormulaBadge } from "../ui/FormulaBadge";
import { createId } from "@/lib/id";


export default function DilutionCalculator() {
    const {
        dilution, setDilution,
        bufferVolume, bufferUnit, solutes, addSolute, updateSolute,
        setBufferVolume, setBufferUnit,
        stocks
    } = useStore();
    const [isStockSelectOpen, setIsStockSelectOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [showVolumeWarning, setShowVolumeWarning] = useState(false);
    const [mwInput, setMwInput] = useState(dilution.mw ? String(dilution.mw) : "");
    const { push } = useToastStore();
    const c1Num = parseFloat(dilution.c1);
    const c2Num = parseFloat(dilution.c2);
    const v2Num = parseFloat(dilution.v2);

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
            const newId = createId();
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
            push("Added to recipe builder.", "success");
        } else if (buttonState === "update" && linkedSoluteId) {
            updateSolute(linkedSoluteId, {
                name: dilution.name,
                mw: dilution.mw > 0 ? dilution.mw.toString() : "",
                conc: dilution.c2,
                unit: dilution.u2,
                stockConc: dilution.c1,
                stockUnit: dilution.u1
            });
            push("Recipe updated.", "success");
        }
    };

    const [liveMW, setLiveMW] = useState<number | null>(null);
    const [liveFormula, setLiveFormula] = useState<string | null>(null);

    const debouncedName = useDebounce(dilution.name, 600);

    useEffect(() => {
        setMwInput(dilution.mw ? String(dilution.mw) : "");
    }, [dilution.mw]);

    useEffect(() => {
        const triggerLookup = async () => {
            const query = debouncedName.trim();
            if (!query) {
                setLiveMW(null);
                setLiveFormula(null);
                return;
            }

            // Always reset live state for a new search to avoid 'ghosting' results
            setLiveMW(null);
            setLiveFormula(null);

            // 1. Try local parse
            const localResult = tryCalculateMw(query);
            if (localResult) {
                setDilution({ mw: localResult.mw });
                setLiveMW(localResult.mw);
                setLiveFormula(localResult.formula);
                return;
            }

            setIsSearching(true);
            try {
                // 2. Try PubChem
                const res = await lookupPubChem(query);
                if (res && res.mw) {
                    const mw = parseFloat(res.mw.toFixed(2));
                    setDilution({ mw });
                    setLiveMW(mw);
                    setLiveFormula(res.formula || null);
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

    const needsMw = (() => {
        const domain1 = isMolar(dilution.u1) ? 'molar' : (isMass(dilution.u1) ? 'mass' : null);
        const domain2 = isMolar(dilution.u2) ? 'molar' : (isMass(dilution.u2) ? 'mass' : null);
        return domain1 !== domain2 && domain1 && domain2;
    })();

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
    const handleC1UnitChange = (unit: string, source: "select" | "parsed") => {
        if (source === "parsed") {
            setDilution({ u1: unit });
            return;
        }

        const current = parseFloat(dilution.c1);
        if (!Number.isFinite(current)) {
            setDilution({ u1: unit });
            return;
        }

        const converted = convertUnitValue(
            current,
            dilution.u1,
            unit,
            dilution.mw > 0 ? dilution.mw : undefined
        );

        if (converted === null) {
            setDilution({ u1: unit });
            return;
        }

        const normalized = parseFloat(converted.toPrecision(8)).toString();
        setDilution({ c1: normalized, u1: unit });
    };

    const handleC2UnitChange = (unit: string, source: "select" | "parsed") => {
        if (source === "parsed") {
            setDilution({ u2: unit });
            return;
        }

        const current = parseFloat(dilution.c2);
        if (!Number.isFinite(current)) {
            setDilution({ u2: unit });
            return;
        }

        const converted = convertUnitValue(
            current,
            dilution.u2,
            unit,
            dilution.mw > 0 ? dilution.mw : undefined
        );

        if (converted === null) {
            setDilution({ u2: unit });
            return;
        }

        const normalized = parseFloat(converted.toPrecision(8)).toString();
        setDilution({ c2: normalized, u2: unit });
    };

    const handleV2UnitChange = (unit: string, source: "select" | "parsed") => {
        if (source === "parsed") {
            setDilution({ vu2: unit });
            return;
        }

        const current = parseFloat(dilution.v2);
        if (!Number.isFinite(current)) {
            setDilution({ vu2: unit });
            return;
        }

        const converted = convertUnitValue(current, dilution.vu2, unit);
        if (converted === null) {
            setDilution({ vu2: unit });
            return;
        }

        const normalized = parseFloat(converted.toPrecision(8)).toString();
        setDilution({ v2: normalized, vu2: unit });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8 pb-10">
            {/* Chemical Info Header */}
            <section className="glass-card flex flex-col sm:flex-row items-start gap-4 sm:gap-6 !py-4">
                <div className="w-full sm:flex-1">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2 text-zinc-500/80">Chemical Component</label>
                    <div className="flex flex-col gap-2">
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
                        {liveFormula && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 shadow-xl backdrop-blur-sm ml-[44px] sm:ml-[48px]">
                                    <FormulaBadge formula={liveFormula} className="text-[10px]" />
                                    <span className="text-[10px] font-mono text-indigo-400">{liveMW} g/mol</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="w-full sm:w-44">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-2">Molecular Weight</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Mw"
                            className="w-full text-sm"
                            value={mwInput}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setMwInput(raw);
                                const parsed = parseValueWithUnit(raw, ["g/mol", "g", "mg", "kg"]);
                                const num = parseFloat(parsed.value);
                                if (Number.isFinite(num)) setDilution({ mw: num });
                            }}
                            onBlur={(e) => {
                                const raw = e.target.value;
                                const parsed = parseValueWithUnit(raw, ["g/mol", "g", "mg", "kg"]);
                                const num = parseFloat(parsed.value);
                                if (Number.isFinite(num)) {
                                    const rounded = parseFloat(num.toFixed(2));
                                    setDilution({ mw: rounded });
                                    setMwInput(rounded.toString());
                                } else {
                                    setMwInput(raw.trim());
                                }
                            }}
                        />
                        <span className="text-zinc-500 text-[10px] sm:text-xs font-mono shrink-0">g/mol</span>
                    </div>
                    {needsMw && (!dilution.mw || dilution.mw <= 0) && (
                        <p className="text-[11px] text-amber-500 mt-1">MW required for mass ↔ molar conversion.</p>
                    )}
                </div>
            </section>

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                {/* Stock Solution */}
                <section className="glass-card">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-indigo-400">Stock Solution (C<sub>1</sub>)</h3>
                        <div className="relative">
                            <button
                                onClick={() => setIsStockSelectOpen(!isStockSelectOpen)}
                                aria-label="Select stock from database"
                                className="text-[10px] flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
                            >
                                <Beaker className="h-3 w-3" />
                                From Database
                            </button>
                            {isStockSelectOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsStockSelectOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-[#0f0f11] border border-white/10 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                                        {stocks.length === 0 ? (
                                            <div className="p-4 text-center text-zinc-500 text-xs italic">
                                                No stocks saved yet. Add one in the Stock Buffers tab.
                                            </div>
                                        ) : (
                                            stocks.map(stock => (
                                                <button
                                                    key={stock.id}
                                                    onClick={() => {
                                                        setDilution({
                                                            c1: stock.concentration,
                                                            u1: stock.unit,
                                                            name: stock.name,
                                                            mw: stock.mw
                                                        });
                                                        setIsStockSelectOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0"
                                                >
                                                    <div className="text-sm font-bold text-white">{stock.name}</div>
                                                    <div className="text-xs text-zinc-400 font-mono">
                                                        {stock.concentration} {stock.unit}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <ValueUnitInput
                                value={dilution.c1}
                                unit={dilution.u1}
                                options={["M", "mM", "μM", "μg/mL", "ng/μL", "mg/mL", "mg/L", "g/L", "pct"]}
                                onValueChange={(raw) => setDilution({ c1: raw })}
                                onUnitChange={handleC1UnitChange}
                                className="flex-1"
                                inputClassName="text-sm"
                                selectClassName="w-24 sm:w-32 text-xs sm:text-sm"
                            />
                        </div>
                        {(!Number.isFinite(c1Num) || c1Num <= 0) ? (
                            <p className="text-[11px] text-amber-500">Enter a positive stock concentration.</p>
                        ) : (
                            <p className="text-[11px] text-zinc-600">Tip: type <span className="font-mono text-zinc-400">10 mM</span> or <span className="font-mono text-zinc-400">5 mg/mL</span>.</p>
                        )}
                    </div>
                </section>

                {/* Target Solution */}
                <section className="glass-card border-indigo-500/20">
                    <h3 className="text-base sm:text-lg font-semibold mb-4 text-emerald-400">Target Solution (C<sub>2</sub>, V<sub>2</sub>)</h3>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <ValueUnitInput
                                value={dilution.c2}
                                unit={dilution.u2}
                                options={["M", "mM", "μM", "μg/mL", "ng/μL", "mg/mL", "mg/L", "g/L", "pct"]}
                                onValueChange={(raw) => setDilution({ c2: raw })}
                                onUnitChange={handleC2UnitChange}
                                isOptionDisabled={(opt) => {
                                    if (isMolar(opt)) {
                                        return (!dilution.mw || dilution.mw <= 0) && !isMolar(dilution.u1);
                                    }
                                    if (isMass(opt) || opt === "pct") {
                                        return (!dilution.mw || dilution.mw <= 0) && !isMass(dilution.u1);
                                    }
                                    return false;
                                }}
                                className="flex-1"
                                inputClassName="text-sm"
                                selectClassName="w-24 sm:w-32 text-xs sm:text-sm"
                            />
                        </div>
                        {(!Number.isFinite(c2Num) || c2Num <= 0) && (
                            <p className="text-[11px] text-amber-500">Enter a positive target concentration.</p>
                        )}
                        <div className="flex gap-2">
                            <ValueUnitInput
                                value={dilution.v2}
                                unit={dilution.vu2}
                                options={["mL", "μL", "L"]}
                                onValueChange={(raw) => setDilution({ v2: raw })}
                                onUnitChange={handleV2UnitChange}
                                className="flex-1"
                                inputClassName="text-sm"
                                selectClassName="w-20 sm:w-24 text-xs sm:text-sm"
                            />
                        </div>
                        {(!Number.isFinite(v2Num) || v2Num <= 0) && (
                            <p className="text-[11px] text-amber-500">Enter a positive final volume.</p>
                        )}
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
