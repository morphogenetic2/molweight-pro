"use client";

import { useStore } from "@/store/useStore";
import { X, Clock, ChevronRight, FlaskConical, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FormulaBadge } from "../ui/FormulaBadge";

export function HistoryPanel() {
    const {
        history, isHistoryOpen, setIsHistoryOpen,
        setMwResult, setMwInput, setDilution, setActiveTab
    } = useStore();

    if (!isHistoryOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsHistoryOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-md h-full bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-2xl"
            >
                <div className="h-20 flex items-center justify-between px-8 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <HistoryIcon className="h-5 w-5 text-indigo-400" />
                        <h2 className="text-lg font-bold">History</h2>
                    </div>
                    <button
                        onClick={() => setIsHistoryOpen(false)}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <Clock className="h-12 w-12 text-zinc-700" />
                            <p className="text-zinc-500">No recent calculations found.</p>
                        </div>
                    ) : (
                        history.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setMwInput(item.name || item.formula);
                                    setMwResult(item);
                                    setActiveTab("mw");
                                    setIsHistoryOpen(false);
                                }}
                                className="w-full text-left group glass-card p-4 border-white/5 hover:border-indigo-500/30 transition-all hover:bg-indigo-500/5"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold truncate pr-4 text-zinc-300 group-hover:text-white transition-colors">
                                        {item.name || "Untitled Chemical"}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                                        MW CALC
                                    </span>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-2">
                                        <FormulaBadge formula={item.formula} className="self-start" />
                                        <span className="text-xs font-mono text-indigo-400/80 font-bold">
                                            {item.mw.toFixed(3)} g/mol
                                        </span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center mb-0">
                        Showing last {history.length} calculations
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

function HistoryIcon({ className }: { className?: string }) {
    return (
        <div className={className}>
            <Clock className="h-full w-full" />
        </div>
    );
}
