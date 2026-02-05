"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { AdjustmentStock } from "@/store/storeTypes";
import { FlaskConical, Calculator, Scale, Droplets, Info, Plus, Trash2, Settings2, Save } from "lucide-react";
import { formatMass, formatVolume } from "@/lib/parser";
import { motion, AnimatePresence } from "framer-motion";
import { parseValueWithUnit } from "@/lib/chemistry/units";

// --- Types ---

type BufferSystem = {
    id: string;
    name: string;
    pKa: number;
    type: "acidic" | "basic"; // acidic diffs from pKa < 7 usually, but mainly denotes if the "main" form is the acid or base for titration mentally
    // Salt Mix Data
    acidComponent?: { name: string; mw: number; formula: string };
    baseComponent?: { name: string; mw: number; formula: string };
    // Titration Data
    baseForm?: { name: string; mw: number; formula: string }; // The starting powder for basic buffers (e.g. Tris Base)
    acidForm?: { name: string; mw: number; formula: string }; // The starting powder for acidic buffers (e.g. Citric Acid)
};

type StockSolution = AdjustmentStock;

// --- Data ---
const BUFFER_SYSTEMS: BufferSystem[] = [
    {
        id: "phosphate",
        name: "Phosphate (PBS Core)",
        pKa: 7.21,
        type: "acidic",
        acidComponent: { name: "Monobasic Sodium Phosphate (Anhydrous)", mw: 119.98, formula: "NaH2PO4" },
        baseComponent: { name: "Dibasic Sodium Phosphate (Anhydrous)", mw: 141.96, formula: "Na2HPO4" },
        // For titration, usually start with one and adjust? Phosphate is tricky for titration, usually done mix.
        // But can be done. NaH2PO4 + NaOH -> Na2HPO4.
        acidForm: { name: "Monobasic Sodium Phosphate", mw: 119.98, formula: "NaH2PO4" },
    },
    {
        id: "tris",
        name: "Tris",
        pKa: 8.06,
        type: "basic",
        acidComponent: { name: "Tris HCl", mw: 157.6, formula: "C4H11NO3·HCl" },
        baseComponent: { name: "Tris Base", mw: 121.14, formula: "C4H11NO3" },
        baseForm: { name: "Tris Base", mw: 121.14, formula: "C4H11NO3" },
        acidForm: { name: "Tris HCl", mw: 157.6, formula: "C4H11NO3·HCl" },
    },
    {
        id: "hepes",
        name: "HEPES",
        pKa: 7.48,
        type: "basic",
        baseForm: { name: "HEPES (Free Acid)", mw: 238.3, formula: "C8H18N2O4S" }, // Actually HEPES is a zwitterion, usually supplied as free acid (zwitterion) which is acidic relative to pKa? No, pKa is 7.5.
        // HEPES Free Acid is the "Acid" form in the pair? No, it's the Zwitterion.
        // Let's standardise: Start with HEPES Free Acid, adjust with NaOH.
        acidForm: { name: "HEPES Free Acid", mw: 238.3, formula: "C8H18N2O4S" },
    },
    {
        id: "acetate",
        name: "Acetate",
        pKa: 4.76,
        type: "acidic",
        acidComponent: { name: "Acetic Acid", mw: 60.05, formula: "CH3COOH" },
        baseComponent: { name: "Sodium Acetate (Trihydrate)", mw: 136.08, formula: "CH3COONa·3H2O" },
        baseForm: { name: "Sodium Acetate (Trihydrate)", mw: 136.08, formula: "CH3COONa·3H2O" }, // Titrate with HCl
        acidForm: { name: "Acetic Acid (Glacial)", mw: 60.05, formula: "CH3COOH" }, // Titrate with NaOH
    },
    {
        id: "citrate",
        name: "Citrate",
        pKa: 6.40, // pKa3. pKa1=3.13, pKa2=4.76. Assuming pH ~6 range for common citrate buffer.
        type: "acidic",
        acidComponent: { name: "Citric Acid (Monohydrate)", mw: 210.14, formula: "C6H8O7·H2O" },
        baseComponent: { name: "Trisodium Citrate (Dihydrate)", mw: 294.10, formula: "Na3C6H5O7·2H2O" },
        acidForm: { name: "Citric Acid (Monohydrate)", mw: 210.14, formula: "C6H8O7·H2O" },
    }
];

export default function BufferCalculator() {
    // --- State ---
    const {
        bufferConfig,
        setBufferConfig,
        addStock,
        adjustmentStocks,
        addAdjustmentStock,
        updateAdjustmentStock,
        removeAdjustmentStock
    } = useStore();
    
    // Destructure config for easier usage
    const { 
        selectedBufferId, method, targetPH, totalVol, volUnit, 
        totalConc, concUnit, selectedStockId 
    } = bufferConfig;

    const setSelectedBufferId = (val: string) => setBufferConfig({ selectedBufferId: val });
    const setMethod = (val: "salt_mix" | "titration") => setBufferConfig({ method: val });
    const setTargetPH = (val: number) => setBufferConfig({ targetPH: val });
    const setTotalVol = (val: number) => setBufferConfig({ totalVol: val });
    const setVolUnit = (val: "L" | "mL") => setBufferConfig({ volUnit: val });
    const setTotalConc = (val: number) => setBufferConfig({ totalConc: val });
    const setConcUnit = (val: "M" | "mM") => setBufferConfig({ concUnit: val });
    const setSelectedStockId = useCallback(
        (val: string) => setBufferConfig({ selectedStockId: val }),
        [setBufferConfig]
    );

    const [isStocksConfigOpen, setIsStocksConfigOpen] = useState(false);
    const [totalConcInput, setTotalConcInput] = useState(totalConc.toString());
    const [totalVolInput, setTotalVolInput] = useState(totalVol.toString());
    const [adjustmentInputs, setAdjustmentInputs] = useState<Record<string, string>>({});

    // --- Computed ---
    const buffer = useMemo(() => BUFFER_SYSTEMS.find(b => b.id === selectedBufferId)!, [selectedBufferId]);

    // Auto-select valid stock if current one is invalid
    useEffect(() => {
        // ... (existing logic)
        // If we are in titration mode, ensure selected stock is compatible with available forms
        if (method === "titration") {
            const currentStock = adjustmentStocks.find(s => s.id === selectedStockId);
            let isValid = false;

            if (currentStock) {
                if (currentStock.type === 'acid' && buffer.baseForm) isValid = true;
                if (currentStock.type === 'base' && buffer.acidForm) isValid = true;
            }

            if (!isValid) {
                // Try to find a valid default
                // Prefer Acid stock if baseForm exists (common for Tris, etc)
                let defaultStock = adjustmentStocks.find(s => s.type === 'acid' && buffer.baseForm);
                if (!defaultStock) defaultStock = adjustmentStocks.find(s => s.type === 'base' && buffer.acidForm);

                if (defaultStock) setSelectedStockId(defaultStock.id);
            }
        }
    }, [buffer, method, adjustmentStocks, selectedStockId, setSelectedStockId]);


    // Export State
    const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
    const { solutes, clearSolutes, addSolute, setBufferVolume, setBufferUnit, setActiveTab } = useStore();

    const performExport = () => {
        if (!result) return;

        clearSolutes();
        setBufferVolume(totalVol.toString());
        setBufferUnit(volUnit);

        if (result.type === "salt_mix" && result.components) {
            result.components.forEach(comp => {
                // Calculate concentration for the component
                // Mass = Conc * Vol * MW => Conc = Mass / (Vol * MW)
                // We have Mass, Vol, MW.
                // Or simply: we calculated Mass from derived Conc in the logic.
                // Let's re-derive conc to pass to builder.
                // The Result object currently doesn't carry MW. We should grab it from buffer config.
                let mw = 0;
                // find component in buffer config
                if (comp.name === buffer.acidComponent?.name) mw = buffer.acidComponent.mw;
                else if (comp.name === buffer.baseComponent?.name) mw = buffer.baseComponent.mw;

                // ConcM = Mass / (MW * VolL)
                // However, we already computed acidConcM and baseConcM in the logic but returned Mass.
                // Ideally, `result` should return the concs too.
                // REFACTOR: Let's assume we can back-calculate or grab it.
                // Actually, let's use the 'mass' we have to calc Molarity.
                const volL = volUnit === "mL" ? totalVol / 1000 : totalVol;
                const concM = mw > 0 ? comp.mass / (mw * volL) : 0;

                addSolute({
                    name: comp.name,
                    formula: comp.formula,
                    mw: mw.toFixed(2),
                    conc: (concM * 1000).toFixed(2), // store as mM by default? Or let's store as M if > 0.1? Let's verify units.
                    // The App default is usually M. Let's convert to reasonable unit?
                    // Let's stick to M for consistency or mM if small.
                    // Let's use mM if < 0.1M
                    unit: concM < 0.1 ? "mM" : "M",
                    concentration: concM < 0.1 ? (concM * 1000).toFixed(2) : concM.toFixed(4)
                });
                
                // Fix: `addSolute` implementation takes raw values.
                // The `addSolute` in store takes `initialData`.
                // We need to pass `conc` (the value) and `unit`.
                // My logic above:
                // if mM: val = concM * 1000
                // if M: val = concM
            });
        } else if (result.type === "titration" && result.start && result.adjuster) {
            // Start Component
            const startComp = result.start;
            const mw = startComp.name === buffer.acidForm?.name ? buffer.acidForm.mw : (buffer.baseForm?.mw || 0);
            
            // Calc concM
            const volL = volUnit === "mL" ? totalVol / 1000 : totalVol;
            const concM = mw > 0 ? startComp.mass / (mw * volL) : 0;

             addSolute({
                name: startComp.name,
                formula: startComp.formula,
                mw: mw.toFixed(2),
                conc: concM < 0.1 ? (concM * 1000).toFixed(2) : concM.toFixed(4),
                unit: concM < 0.1 ? "mM" : "M"
            });

            // Adjuster
            // It's a volume of a stock.
            // We can add it as a "Stock" with "Dilution" or just a component with calculated target conc.
            // Target Conc in final volume = (Vol_adj * Conc_adj) / Vol_final
            // Actually result.adjuster.concName is just the name. 
            // We know `selectedStockId`.
            const stock = adjustmentStocks.find(s => s.id === selectedStockId);
            
            if (stock) {
                // M1V1 = M2V2 -> M2 = (M1*V1)/V2
                const m2 = ((stock.concM ?? 0) * result.adjuster.vol) / volL;
                
                addSolute({
                    name: stock.name,
                    isStock: true,
                    stockConc: (stock.concM ?? 0).toString(),
                    stockUnit: "M", // Stocks in calculator are M
                    conc: m2 < 0.1 ? (m2 * 1000).toFixed(2) : m2.toFixed(4),
                    unit: m2 < 0.1 ? "mM" : "M",
                    mw: "0", // Unknown MW for generic stock usually? Or we could assume HCl/NaOH. 
                    // Stock config doesn't have MW.
                    formula: ""
                });
            }
        }

        setShowOverwriteWarning(false);
        setActiveTab("buffer_recipe");
    };

    const handleExportToBuilder = () => {
        if (solutes.length > 0) {
            setShowOverwriteWarning(true);
        } else {
            performExport();
        }
    };

    // Calculation Logic
    const result = (() => {
        const volL = volUnit === "mL" ? totalVol / 1000 : totalVol;
        const concM = concUnit === "mM" ? totalConc / 1000 : totalConc;

        // Ratio R = [Base]/[Acid]
        // pH = pKa + log(R) -> log(R) = pH - pKa -> R = 10^(pH - pKa)
        const ratio = Math.pow(10, targetPH - buffer.pKa);

        // Total Conc C = [A] + [B]
        // R = B/A -> B = R*A
        // C = A + R*A = A(1+R)
        // [A] = C / (1+R)
        // [B] = C - [A]

        const acidConcM = concM / (1 + ratio);
        const baseConcM = concM - acidConcM;

        if (method === "salt_mix") {
            if (!buffer.acidComponent || !buffer.baseComponent) return null;

            const acidMass = acidConcM * volL * buffer.acidComponent.mw;
            const baseMass = baseConcM * volL * buffer.baseComponent.mw;

            return {
                type: "salt_mix",
                components: [
                    { name: buffer.acidComponent.name, mass: acidMass, formula: buffer.acidComponent.formula },
                    { name: buffer.baseComponent.name, mass: baseMass, formula: buffer.baseComponent.formula }
                ]
            };
        } else {
            // Titration
            // We start with ONE component (Total Molarity) and add strong adjuster.

            let startComp: { name: string, mw: number, formula: string } | null = null;
            const adjusterComp: StockSolution | undefined = adjustmentStocks.find(s => s.id === selectedStockId) as StockSolution | undefined;
            let requiredMolesAdjuster = 0;

            if (!adjusterComp) return null;

            if (adjusterComp.type === 'acid') {
                // Titrating with Acid -> Must start with Base form
                // Reaction: B + H+ -> BH+
                // Need to form 'acidConcM' amount of BH+
                if (!buffer.baseForm) return null;
                startComp = buffer.baseForm;
                requiredMolesAdjuster = acidConcM * volL;
            } else {
                // Titrating with Base -> Must start with Acid form
                // Reaction: HA + OH- -> A- + H2O
                // Need to form 'baseConcM' amount of A-
                if (!buffer.acidForm) return null;
                startComp = buffer.acidForm;
                requiredMolesAdjuster = baseConcM * volL;
            }

            if (!startComp) return null;

            const startMass = concM * volL * startComp.mw;
            const adjusterVolL = requiredMolesAdjuster / adjusterComp.concM;

            return {
                type: "titration",
                start: { name: startComp.name, mass: startMass, formula: startComp.formula },
                adjuster: { name: adjusterComp.name, vol: adjusterVolL, concName: adjusterComp.name }
            };
        }
    })();


    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Config */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Main Inputs */}
                <div className="md:col-span-8 glass-card space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <Calculator className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-100">Configuration</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Buffer System */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Buffer System</label>
                            <select
                                value={selectedBufferId}
                                onChange={(e) => setSelectedBufferId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:bg-white/10 transition-colors"
                            >
                                {BUFFER_SYSTEMS.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-zinc-500">
                                pKa {buffer.pKa} at 25°C <span className="text-zinc-600 mx-1">|</span> Useful range: <span className="text-zinc-400">{(buffer.pKa - 1).toFixed(1)} – {(buffer.pKa + 1).toFixed(1)}</span>
                            </p>
                        </div>

                        {/* Method */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Preparation Method</label>
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                <button
                                    onClick={() => setMethod("titration")}
                                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${method === "titration" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
                                >
                                    Titration
                                </button>
                                <button
                                    onClick={() => setMethod("salt_mix")}
                                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${method === "salt_mix" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
                                >
                                    Salt Mix
                                </button>
                            </div>
                        </div>

                        {/* Target pH */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Target pH</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="14"
                                    value={targetPH}
                                    onChange={(e) => setTargetPH(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                            {(targetPH < buffer.pKa - 1.5 || targetPH > buffer.pKa + 1.5) && (
                                <p className="text-xs text-amber-500 flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Outside optimal range ({buffer.pKa - 1}-{buffer.pKa + 1})
                                </p>
                            )}
                        </div>

                        {/* Concentration */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Final Concentration</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={totalConcInput}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setTotalConcInput(raw);
                                        const parsed = parseValueWithUnit(raw, ["mM", "M"]);
                                        const num = parseFloat(parsed.value);
                                        if (Number.isFinite(num)) setTotalConc(num);
                                        if (parsed.unit) setConcUnit(parsed.unit as "M" | "mM");
                                    }}
                                    onBlur={(e) => {
                                        const raw = e.target.value;
                                        const parsed = parseValueWithUnit(raw, ["mM", "M"]);
                                        const num = parseFloat(parsed.value);
                                        if (Number.isFinite(num)) {
                                            setTotalConc(num);
                                            setTotalConcInput(parsed.value);
                                        } else {
                                            setTotalConcInput(raw.trim());
                                        }
                                        if (parsed.unit) setConcUnit(parsed.unit as "M" | "mM");
                                    }}
                                    className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                                <select
                                    value={concUnit}
                                    onChange={(e) => setConcUnit(e.target.value as "M" | "mM")}
                                    className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value="mM" className="bg-zinc-900">mM</option>
                                    <option value="M" className="bg-zinc-900">M</option>
                                </select>
                            </div>
                        </div>

                        {/* Volume */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Volume</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={totalVolInput}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setTotalVolInput(raw);
                                        const parsed = parseValueWithUnit(raw, ["L", "mL"]);
                                        const num = parseFloat(parsed.value);
                                        if (Number.isFinite(num)) setTotalVol(num);
                                        if (parsed.unit) setVolUnit(parsed.unit as "L" | "mL");
                                    }}
                                    onBlur={(e) => {
                                        const raw = e.target.value;
                                        const parsed = parseValueWithUnit(raw, ["L", "mL"]);
                                        const num = parseFloat(parsed.value);
                                        if (Number.isFinite(num)) {
                                            setTotalVol(num);
                                            setTotalVolInput(parsed.value);
                                        } else {
                                            setTotalVolInput(raw.trim());
                                        }
                                        if (parsed.unit) setVolUnit(parsed.unit as "L" | "mL");
                                    }}
                                    className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                                <select
                                    value={volUnit}
                                    onChange={(e) => setVolUnit(e.target.value as "L" | "mL")}
                                    className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value="L" className="bg-zinc-900">L</option>
                                    <option value="mL" className="bg-zinc-900">mL</option>
                                </select>
                            </div>
                        </div>

                        {/* Stock Selection (Titration Only) */}
                        {method === "titration" && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Adjust With</label>
                                    <button onClick={() => setIsStocksConfigOpen(true)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                        <Settings2 className="h-3 w-3" /> Config
                                    </button>
                                </div>
                                <select
                                    value={selectedStockId}
                                    onChange={(e) => setSelectedStockId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    {adjustmentStocks.filter(s => {
                                        // Only show stocks that are compatible with available buffer forms
                                        if (s.type === 'acid' && !buffer.baseForm) return false;
                                        if (s.type === 'base' && !buffer.acidForm) return false;
                                        return true;
                                    }).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.concM}M {s.type === 'acid' ? 'Acid' : 'Base'})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recipe Output */}
                <div className="md:col-span-4 space-y-6">
                    <div className="glass-card h-full flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                        <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <Scale className="h-5 w-5" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-100">Recipe</h2>
                        </div>

                        <div className="flex-1 space-y-6">
                            {result ? (
                                <>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-sm text-zinc-400">
                                            <span>Preparation Checklist</span>
                                        </div>

                                        {/* Instructions */}
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="mt-1 h-5 w-5 shrink-0 rounded-full border border-zinc-700 bg-white/5 flex items-center justify-center text-xs text-zinc-500 font-mono">1</div>
                                                <p className="text-sm text-zinc-300">
                                                    Start with <span className="text-emerald-400 font-bold">{(totalVol * (volUnit === 'mL' ? 0.8 : 0.8)).toFixed(2)} {volUnit}</span> of water.
                                                </p>
                                            </div>

                                            {result.type === 'salt_mix' && result.components!.map((comp, i) => (
                                                <div key={i} className="flex gap-3">
                                                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full border border-zinc-700 bg-white/5 flex items-center justify-center text-xs text-zinc-500 font-mono">{i + 2}</div>
                                                    <div>
                                                        <p className="text-sm text-zinc-300">Add <span className="text-white font-bold">{formatMass(comp.mass)}</span> of</p>
                                                        <p className="text-sm font-medium text-emerald-400">{comp.name}</p>
                                                        <p className="text-xs text-zinc-500 font-mono">{comp.formula}</p>
                                                    </div>
                                                </div>
                                            ))}

                                            {result.type === 'titration' && (
                                                <>
                                                    <div className="flex gap-3">
                                                        <div className="mt-1 h-5 w-5 shrink-0 rounded-full border border-zinc-700 bg-white/5 flex items-center justify-center text-xs text-zinc-500 font-mono">2</div>
                                                        <div>
                                                            <p className="text-sm text-zinc-300">Add <span className="text-white font-bold">{formatMass(result.start!.mass)}</span> of</p>
                                                            <p className="text-sm font-medium text-emerald-400">{result.start!.name}</p>
                                                            <p className="text-xs text-zinc-500 font-mono">{result.start!.formula}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className="mt-1 h-5 w-5 shrink-0 rounded-full border border-zinc-700 bg-white/5 flex items-center justify-center text-xs text-zinc-500 font-mono">3</div>
                                                        <div>
                                                            <p className="text-sm text-zinc-300">Adjust pH to <span className="text-white font-bold">{targetPH}</span> using</p>
                                                            <p className="text-sm font-medium text-indigo-400">~{formatVolume(result.adjuster!.vol)} of {result.adjuster!.concName}</p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div className="flex gap-3">
                                                <div className="mt-1 h-5 w-5 shrink-0 rounded-full border border-zinc-700 bg-white/5 flex items-center justify-center text-xs text-zinc-500 font-mono">
                                                    {result.type === 'salt_mix' ? 4 : 4}
                                                </div>
                                                <p className="text-sm text-zinc-300">
                                                    Top up water to <span className="text-emerald-400 font-bold">{totalVol} {volUnit}</span>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 mt-4">
                                        <button
                                            onClick={() => {
                                                addStock({
                                                    id: Math.random().toString(36).substr(2, 9),
                                                    name: `${buffer.name} pH ${targetPH}`,
                                                    formula: "",
                                                    mw: 0,
                                                    conc: 0,
                                                    concentration: totalConc.toString(),
                                                    unit: concUnit,
                                                    volume: totalVol.toString(),
                                                    volUnit: volUnit,
                                                    dateAdded: new Date().toISOString()
                                                });
                                                // Optional: Show toast
                                            }}
                                            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold flex items-center justify-center gap-2"
                                        >
                                            <Save className="h-4 w-4" />
                                            Save Result as Stock
                                        </button>

                                        <button
                                            onClick={handleExportToBuilder}
                                            className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-indigo-400 font-bold flex items-center justify-center gap-2"
                                        >
                                            <FlaskConical className="h-4 w-4" />
                                            Export to Recipe Builder
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-10 text-zinc-500">
                                    <p>Invalid Configuration</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>

            {/* Overwrite Warning Modal */}
            <AnimatePresence>
                {showOverwriteWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0f0f11] border border-amber-500/20 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 text-amber-500">
                                    <Info className="h-6 w-6" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Overwrite Current Recipe?</h3>
                                <p className="text-zinc-400 text-sm mb-6">
                                    The Recipe Builder already has items in it. Exporting this calculation will clear the existing recipe.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowOverwriteWarning(false)}
                                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors text-sm font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={performExport}
                                        className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-colors text-sm font-bold"
                                    >
                                        Overwrite
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Stocks Config Modal */}
            <AnimatePresence>
                {
                    isStocksConfigOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-[#0f0f11] border border-white/10 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
                            >
                                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-white">pH Adjustment Stocks</h3>
                                    <button onClick={() => setIsStocksConfigOpen(false)} className="text-zinc-500 hover:text-white">Close</button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        {adjustmentStocks.map((stock) => (
                                            <div key={stock.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            // Toggle Acid/Base
                                                            updateAdjustmentStock(stock.id, { type: stock.type === 'acid' ? 'base' : 'acid' });
                                                        }}
                                                        className={`p-2 rounded-lg transition-colors ${stock.type === 'acid' ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                                                        title="Click to toggle Acid/Base"
                                                    >
                                                        <Droplets className="h-4 w-4" />
                                                    </button>
                                                    <span className={`text-[10px] font-bold uppercase ${stock.type === 'acid' ? 'text-orange-400' : 'text-blue-400'}`}>
                                                        {stock.type}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <input
                                                        value={stock.name}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const updates: Partial<AdjustmentStock> = { name: val };

                                                            // Simple Auto-detection
                                                            const lower = val.toLowerCase();
                                                            if (lower.includes("hcl") || lower.includes("acid") || lower.includes("h2so4")) {
                                                                updates.type = 'acid';
                                                            } else if (lower.includes("naoh") || lower.includes("koh") || lower.includes("base") || lower.includes("hydroxide")) {
                                                                updates.type = 'base';
                                                            }

                                                            updateAdjustmentStock(stock.id, updates);
                                                        }}
                                                        className="bg-transparent border-none text-sm font-bold text-white focus:ring-0 w-full"
                                                    />
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                        <span>Conc:</span>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={adjustmentInputs[stock.id] ?? (stock.concM ?? "").toString()}
                                                            onChange={(e) => {
                                                                const raw = e.target.value;
                                                                setAdjustmentInputs((prev) => ({ ...prev, [stock.id]: raw }));
                                                                const parsed = parseValueWithUnit(raw, ["M", "mM"]);
                                                                let val = parseFloat(parsed.value);
                                                                if (Number.isFinite(val)) {
                                                                    if (parsed.unit === "mM") val = val / 1000;
                                                                    updateAdjustmentStock(stock.id, { concM: val });
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                const raw = e.target.value;
                                                                const parsed = parseValueWithUnit(raw, ["M", "mM"]);
                                                                let val = parseFloat(parsed.value);
                                                                if (Number.isFinite(val)) {
                                                                    if (parsed.unit === "mM") val = val / 1000;
                                                                    updateAdjustmentStock(stock.id, { concM: val });
                                                                    setAdjustmentInputs((prev) => ({ ...prev, [stock.id]: val.toString() }));
                                                                } else {
                                                                    setAdjustmentInputs((prev) => ({ ...prev, [stock.id]: raw.trim() }));
                                                                }
                                                            }}
                                                            className="bg-transparent border-b border-zinc-700 w-12 text-center focus:outline-none"
                                                        />
                                                        <span>M</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeAdjustmentStock(stock.id)}
                                                    className="p-2 text-zinc-600 hover:text-red-400"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newId = `custom_${Date.now()}`;
                                            addAdjustmentStock({ id: newId, name: "New Stock", concM: 1, type: "acid" });
                                        }}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-zinc-400 text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" /> Add Stock Solution
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}
