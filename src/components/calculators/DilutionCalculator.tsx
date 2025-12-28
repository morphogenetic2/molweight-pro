"use client";

import { useStore } from "@/store/useStore";
import { formatMass, formatVolume } from "@/lib/parser";
import { motion, AnimatePresence } from "framer-motion";

export default function DilutionCalculator() {
    const { dilution, setDilution } = useStore();

    // Basic calculation logic
    const calculateDilution = () => {
        const c1 = parseFloat(dilution.c1);
        const c2 = parseFloat(dilution.c2);
        const v2 = parseFloat(dilution.v2);

        if (isNaN(c1) || isNaN(c2) || isNaN(v2) || c1 <= 0) return null;

        // Simplest form for now: V1 = (C2 * V2) / C1
        const v1 = (c2 * v2) / c1;
        const solvent = v2 - v1;

        return { v1, solvent };
    };

    const results = calculateDilution();

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Stock Solution */}
                <section className="glass-card">
                    <h3 className="text-lg font-semibold mb-4 text-indigo-400">Stock Solution (C1)</h3>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Concentration"
                                className="flex-1"
                                value={dilution.c1}
                                onChange={(e) => setDilution({ c1: e.target.value })}
                            />
                            <select
                                className="w-24"
                                value={dilution.u1}
                                onChange={(e) => setDilution({ u1: e.target.value })}
                            >
                                <option>M</option>
                                <option>mM</option>
                                <option>μM</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Target Solution */}
                <section className="glass-card border-indigo-500/20">
                    <h3 className="text-lg font-semibold mb-4 text-emerald-400">Target Solution (C2, V2)</h3>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Target Conc (C2)"
                                className="flex-1"
                                value={dilution.c2}
                                onChange={(e) => setDilution({ c2: e.target.value })}
                            />
                            <select
                                className="w-24"
                                value={dilution.u2}
                                onChange={(e) => setDilution({ u2: e.target.value })}
                            >
                                <option>M</option>
                                <option>mM</option>
                                <option>μM</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Final Volume (V2)"
                                className="flex-1"
                                value={dilution.v2}
                                onChange={(e) => setDilution({ v2: e.target.value })}
                            />
                            <select
                                className="w-24"
                                value={dilution.vu2}
                                onChange={(e) => setDilution({ vu2: e.target.value })}
                            >
                                <option>mL</option>
                                <option>μL</option>
                                <option>L</option>
                            </select>
                        </div>
                    </div>
                </section>
            </div>

            <AnimatePresence>
                {results && (
                    <motion.section
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card overflow-hidden border-indigo-500/30"
                    >
                        <div className="grid md:grid-cols-2 divide-x divide-white/5">
                            <div className="p-8 text-center">
                                <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold mb-2">Volume of Stock (V1)</p>
                                <p className="text-4xl font-black text-indigo-400 font-mono">
                                    {results.v1.toFixed(3)} {dilution.vu2}
                                </p>
                            </div>
                            <div className="p-8 text-center">
                                <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold mb-2">Volume of Solvent</p>
                                <p className="text-4xl font-black text-emerald-400 font-mono">
                                    {results.solvent.toFixed(3)} {dilution.vu2}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white/5 px-6 py-4 text-center text-sm text-zinc-400 italic">
                            Instructions: Take {results.v1.toFixed(3)} {dilution.vu2} of stock and add solvent until reaching {dilution.v2} {dilution.vu2} final volume.
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
    );
}
