"use client";

import { useState } from "react";
import { useStore, Stock } from "@/store/useStore";
import { Plus, Search, Trash2, Beaker, FileSpreadsheet, Loader2, Save, AlertTriangle } from "lucide-react";
import { lookupPubChem } from "@/lib/api";
import { calculateMw, parseFormula, formatConcentration } from "@/lib/parser";
import { FormulaBadge } from "../ui/FormulaBadge";
import { motion, AnimatePresence } from "framer-motion";

export function StockManager() {
    const { stocks, addStock, updateStock, removeStock } = useStore();
    const [isCreating, setIsCreating] = useState(false);

    // New Stock Form State
    const [newName, setNewName] = useState("");
    const [newFormula, setNewFormula] = useState("");
    const [newMw, setNewMw] = useState("");
    const [newConc, setNewConc] = useState("");
    const [newUnit, setNewUnit] = useState("M");
    const [newVol, setNewVol] = useState("");
    const [newVolUnit, setNewVolUnit] = useState("mL");
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Warning Modal State
    const [showWarning, setShowWarning] = useState(false);

    const handleLookup = async () => {
        if (!newName) return;
        setIsSearching(true);
        try {
            const res = await lookupPubChem(newName);
            if (res) {
                setNewName(res.name || newName);
                setNewFormula(res.formula || "");
                setNewMw(res.mw?.toFixed(2) || "");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const saveStock = (mw: number, formula: string) => {
        const newStock: Stock = {
            id: Math.random().toString(36).substr(2, 9),
            name: newName,
            formula: formula,
            mw: mw,
            conc: 0,
            concentration: newConc,
            unit: newUnit,
            volume: newVol,
            volUnit: newVolUnit,
            dateAdded: new Date().toISOString()
        };

        addStock(newStock);

        // Reset form
        setNewName("");
        setNewConc("");
        setNewVol("");
        setIsCreating(false);
        setIsSaving(false);
        setShowWarning(false);
    };

    const handleCreate = async () => {
        if (!newName || !newConc) return;

        setIsSaving(true);

        try {
            // PubChem Lookup
            const res = await lookupPubChem(newName);

            if (res) {
                // Success - Save immediately
                saveStock(res.mw || 0, res.formula || "");
            } else {
                // Failed - Show Warning
                setShowWarning(true);
                // Note: We stay in isSaving=true state until user decides
            }
        } catch (error) {
            console.error("Auto-lookup failed:", error);
            setShowWarning(true);
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-8 relative">
            {/* Warning Modal */}
            <AnimatePresence>
                {showWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => {
                                setShowWarning(false);
                                setIsSaving(false);
                            }}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative w-full max-w-md bg-[#18181b] border border-amber-500/20 rounded-2xl p-6 shadow-2xl z-10"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">Chemical Not Found</h3>
                                    <p className="text-zinc-400 text-sm">
                                        We couldn't find details for <span className="text-white font-bold">"{newName}"</span> in the database.
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-3 bg-white/5 p-3 rounded-lg border border-white/5">
                                        If you save anyway, molecular weight will be set to 0. This may prevent proper calculation in the Recipe Builder.
                                    </p>
                                </div>

                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => {
                                            setShowWarning(false);
                                            setIsSaving(false);
                                        }}
                                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors text-sm font-bold"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={() => saveStock(0, "")}
                                        className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-colors text-sm font-bold"
                                    >
                                        Save Anyway
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
                        Stock Solutions Database
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Manage your lab's inventory of stock solutions.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="primary flex items-center gap-2 px-4 py-2"
                >
                    <Plus className="h-4 w-4" />
                    Add New Stock
                </button>
            </div>
            {/* Creation Form */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass-card p-6 border-emerald-500/20 bg-emerald-500/5">
                            <h3 className="text-lg font-bold text-white mb-4">Add New Stock Solution</h3>

                            <div className="flex flex-col gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Chemical Name</label>
                                    <input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="e.g. Tris-HCl"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">Concentration</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={newConc}
                                                onChange={(e) => setNewConc(e.target.value)}
                                                placeholder="1.0"
                                                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                                            />
                                            <select
                                                value={newUnit}
                                                onChange={(e) => setNewUnit(e.target.value)}
                                                className="bg-black/20 border border-white/10 rounded-xl px-3 text-zinc-400"
                                            >
                                                <option value="M">M</option>
                                                <option value="mM">mM</option>
                                                <option value="μM">μM</option>
                                                <option value="mg/mL">mg/mL</option>
                                                <option value="g/L">g/L</option>
                                                <option value="pct">%</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">Available Volume (Optional)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={newVol}
                                                onChange={(e) => setNewVol(e.target.value)}
                                                placeholder="500"
                                                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                                            />
                                            <select
                                                value={newVolUnit}
                                                onChange={(e) => setNewVolUnit(e.target.value)}
                                                className="bg-black/20 border border-white/10 rounded-xl px-3 text-zinc-400"
                                            >
                                                <option value="mL">mL</option>
                                                <option value="L">L</option>
                                                <option value="μL">μL</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newName || !newConc}
                                    className="primary px-6 py-2 flex items-center gap-2"
                                >
                                    <Save className="h-4 w-4" />
                                    Save to Database
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stock List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(stocks || []).length === 0 ? (
                    <div className="col-span-full py-12 text-center text-zinc-500 italic bg-white/5 rounded-3xl border border-white/5">
                        No stock solutions saved yet.
                    </div>
                ) : (
                    (stocks || []).map((stock) => (
                        <div key={stock.id} className="group relative p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all hover:-translate-y-1">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-white text-lg leading-tight">{stock.name}</h3>
                                    {stock.formula && (
                                        <div className="mt-1">
                                            <FormulaBadge formula={stock.formula} className="text-[10px] px-1.5 py-0.5" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-sm border border-emerald-500/20">
                                    {stock.concentration} <span className="text-xs opacity-70">{stock.unit === 'pct' ? '%' : stock.unit}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-3 border-t border-white/5 mt-3">
                                <div>
                                    <span className="block text-[10px] font-bold text-zinc-500 uppercase">MW</span>
                                    <span className="font-mono text-zinc-300 text-sm">{stock.mw}</span>
                                </div>
                                {stock.volume && (
                                    <div>
                                        <span className="block text-[10px] font-bold text-zinc-500 uppercase">Volume</span>
                                        <span className="font-mono text-zinc-300 text-sm">{stock.volume} {stock.volUnit}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => removeStock(stock.id)}
                                className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
