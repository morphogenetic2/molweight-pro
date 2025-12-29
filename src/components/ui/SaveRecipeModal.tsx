"use client";

import { useStore } from "@/store/useStore";
import { useState } from "react";
import { X, Save, FileText, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SaveRecipeModal() {
    const { isSaveRecipeOpen, setIsSaveRecipeOpen, saveRecipe, solutes } = useStore();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    if (!isSaveRecipeOpen) return null;

    const handleSave = () => {
        if (!name.trim()) return;
        saveRecipe(name, description);
        setName("");
        setDescription("");
        setIsSaveRecipeOpen(false);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSaveRecipeOpen(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                >
                    <div className="px-6 py-4 sm:px-8 sm:py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <Save className="h-5 w-5 text-indigo-400" />
                            <h2 className="text-lg sm:text-xl font-bold italic tracking-tight">Save Recipe</h2>
                        </div>
                        <button
                            onClick={() => setIsSaveRecipeOpen(false)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">
                                    Recipe Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. My Custom PBS"
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add notes about this recipe..."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="glass-card p-4 border-white/5 bg-white/[0.01]">
                            <div className="flex items-center gap-3 text-zinc-400">
                                <FileText className="h-4 w-4" />
                                <span className="text-xs">{solutes.length} ingredients will be saved.</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={!name.trim()}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
                        >
                            Save Template
                            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
