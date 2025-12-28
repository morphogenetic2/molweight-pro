"use client";

import { useStore } from "@/store/useStore";
import { X, Trash2, Info, Github, ShieldCheck, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SettingsModal() {
    const { isSettingsOpen, setIsSettingsOpen, resetStore } = useStore();

    if (!isSettingsOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSettingsOpen(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                >
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <SettingsIcon className="h-5 w-5 text-indigo-400" />
                            <h2 className="text-xl font-bold italic tracking-tight">Settings</h2>
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Section: Data Management */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <Database className="h-4 w-4" />
                                <h3 className="text-sm font-bold uppercase tracking-widest">Data Management</h3>
                            </div>
                            <div className="glass-card p-6 border-white/5 bg-red-500/[0.02]">
                                <div className="flex items-center justify-between gap-6">
                                    <div>
                                        <h4 className="font-bold text-white mb-1">Reset Application</h4>
                                        <p className="text-xs text-zinc-500 leading-relaxed">
                                            This will permanently clear all history, recipes, and calculator inputs. This action cannot be undone.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm("Are you sure you want to clear all data?")) {
                                                resetStore();
                                                setIsSettingsOpen(false);
                                            }
                                        }}
                                        className="shrink-0 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all group"
                                    >
                                        <Trash2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Section: About */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <Info className="h-4 w-4" />
                                <h3 className="text-sm font-bold uppercase tracking-widest">About</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="glass-card p-6 border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-zinc-400">Version</span>
                                        <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/20">v1.2.0-PRO</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-400">Build ID</span>
                                        <span className="text-[10px] font-mono text-zinc-600">PRODUCTION_STABLE</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <a
                                        href="https://github.com/molweight-pro/app"
                                        target="_blank"
                                        className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium text-zinc-300"
                                    >
                                        <Github className="h-4 w-4" /> Github
                                    </a>
                                    <div className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-sm font-medium">
                                        <ShieldCheck className="h-4 w-4" /> Secure App
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function SettingsIcon({ className }: { className?: string }) {
    return (
        <div className={className}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        </div>
    );
}
