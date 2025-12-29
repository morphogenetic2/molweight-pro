"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { FlaskConical, Calculator, Scale, Droplets, Info, Plus, Trash2, Settings2 } from "lucide-react";
import { formatMass, formatVolume } from "@/lib/parser";
import { motion, AnimatePresence } from "framer-motion";

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

type StockSolution = {
    id: string;
    name: string;
    concM: number; // Molarity
    type: "acid" | "base";
};

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

const DEFAULT_STOCKS: StockSolution[] = [
    { id: "hcl_1m", name: "HCl 1M", concM: 1, type: "acid" },
    { id: "hcl_5m", name: "HCl 5M", concM: 5, type: "acid" },
    { id: "naoh_1m", name: "NaOH 1M", concM: 1, type: "base" },
    { id: "naoh_10m", name: "NaOH 10M", concM: 10, type: "base" },
];

export default function BufferCalculator() {
    // --- State ---
    const [selectedBufferId, setSelectedBufferId] = useState<string>("tris");
    const [method, setMethod] = useState<"salt_mix" | "titration">("titration");
    const [targetPH, setTargetPH] = useState<number>(8.0);
    const [totalVol, setTotalVol] = useState<number>(1); // Liters
    const [totalConc, setTotalConc] = useState<number>(0.1); // Molar (100mM)
    const [volUnit, setVolUnit] = useState<"L" | "mL">("L");
    const [concUnit, setConcUnit] = useState<"M" | "mM">("mM");

    // Stocks Config
    const [stocks, setStocks] = useState<StockSolution[]>(DEFAULT_STOCKS);
    const [selectedStockId, setSelectedStockId] = useState<string>(""); // For titration
    const [isStocksConfigOpen, setIsStocksConfigOpen] = useState(false);

    // --- Computed ---
    const buffer = useMemo(() => BUFFER_SYSTEMS.find(b => b.id === selectedBufferId)!, [selectedBufferId]);

    // Auto-select valid stock if current one is invalid
    useEffect(() => {
        // If we are in titration mode, ensure selected stock is compatible with available forms
        if (method === "titration") {
            const currentStock = stocks.find(s => s.id === selectedStockId);
            let isValid = false;

            if (currentStock) {
                if (currentStock.type === 'acid' && buffer.baseForm) isValid = true;
                if (currentStock.type === 'base' && buffer.acidForm) isValid = true;
            }

            if (!isValid) {
                // Try to find a valid default
                // Prefer Acid stock if baseForm exists (common for Tris, etc)
                let defaultStock = stocks.find(s => s.type === 'acid' && buffer.baseForm);
                if (!defaultStock) defaultStock = stocks.find(s => s.type === 'base' && buffer.acidForm);

                if (defaultStock) setSelectedStockId(defaultStock.id);
            }
        }
    }, [buffer, method, stocks, selectedStockId]);

    // Calculation Logic
    const result = useMemo(() => {
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
            let adjusterComp: StockSolution | undefined = stocks.find(s => s.id === selectedStockId);
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
    }, [buffer, method, targetPH, totalVol, volUnit, totalConc, concUnit, stocks, selectedStockId]);


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
                            <p className="text-xs text-zinc-500">pKa {buffer.pKa} at 25°C</p>
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
                                    value={targetPH}
                                    onChange={(e) => setTargetPH(parseFloat(e.target.value))}
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
                                    type="number"
                                    value={totalConc}
                                    onChange={(e) => setTotalConc(parseFloat(e.target.value))}
                                    className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                                <select
                                    value={concUnit}
                                    onChange={(e) => setConcUnit(e.target.value as any)}
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
                                    type="number"
                                    value={totalVol}
                                    onChange={(e) => setTotalVol(parseFloat(e.target.value))}
                                    className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                                <select
                                    value={volUnit}
                                    onChange={(e) => setVolUnit(e.target.value as any)}
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
                                    {stocks.filter(s => {
                                        // Only show stocks that are compatible with available buffer forms
                                        if (s.type === 'acid' && !buffer.baseForm) return false;
                                        if (s.type === 'base' && !buffer.acidForm) return false;
                                        return true;
                                    }).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.type === 'acid' ? 'Acid' : 'Base'})</option>
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

            {/* Stocks Config Modal */}
            <AnimatePresence>
                {isStocksConfigOpen && (
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
                                    {stocks.map((stock, idx) => (
                                        <div key={stock.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex flex-col items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        const newStocks = [...stocks];
                                                        newStocks[idx].type = stock.type === 'acid' ? 'base' : 'acid';
                                                        setStocks(newStocks);
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
                                                        const newStocks = [...stocks];
                                                        const val = e.target.value;
                                                        newStocks[idx].name = val;

                                                        // Simple Auto-detection
                                                        const lower = val.toLowerCase();
                                                        if (lower.includes("hcl") || lower.includes("acid") || lower.includes("h2so4")) {
                                                            newStocks[idx].type = 'acid';
                                                        } else if (lower.includes("naoh") || lower.includes("koh") || lower.includes("base") || lower.includes("hydroxide")) {
                                                            newStocks[idx].type = 'base';
                                                        }

                                                        setStocks(newStocks);
                                                    }}
                                                    className="bg-transparent border-none text-sm font-bold text-white focus:ring-0 w-full"
                                                />
                                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                    <span>Conc:</span>
                                                    <input
                                                        type="number"
                                                        value={stock.concM}
                                                        onChange={(e) => {
                                                            const newStocks = [...stocks];
                                                            newStocks[idx].concM = parseFloat(e.target.value);
                                                            setStocks(newStocks);
                                                        }}
                                                        className="bg-transparent border-b border-zinc-700 w-12 text-center focus:outline-none"
                                                    />
                                                    <span>M</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setStocks(stocks.filter(s => s.id !== stock.id))}
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
                                        setStocks([...stocks, { id: newId, name: "New Stock", concM: 1, type: "acid" }]);
                                    }}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-zinc-400 text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" /> Add Stock Solution
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
