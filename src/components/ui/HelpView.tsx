
import { motion } from "framer-motion";
import {
    Table2,
    Pipette,
    Scale,
    Calculator,
    FlaskConical,
    BookOpen,
    ArrowRight,
    Beaker
} from "lucide-react";
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export function HelpView() {
    const sections = [
        {
            title: "Molecular Weight Calculator",
            icon: Table2,
            content: (
                <div className="space-y-4 text-zinc-300">
                    <p>
                        Calculate the molar mass of any chemical compound instantly.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-white">Chemical Formulas:</strong> Type standard formulas like <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">H2SO4</code> or <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">CuSO4·5H2O</code>. You can use * and . to indicate hydration states.
                        </li>
                        <li>
                            <strong className="text-white">Common Names:</strong> Type a name like "Aspirin" or "Ethanol". The app uses PubChem to find the structure and weight.
                        </li>
                        <li>
                            <strong className="text-white">History:</strong> Successful calculations are saved (clock icon) for quick access later.
                        </li>
                    </ul>
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <h4 className="font-bold text-emerald-400 mb-2">📝 Worked Example</h4>
                        <p className="text-sm">
                            <strong>Goal:</strong> Find the molecular weight of Copper Sulfate Pentahydrate.
                        </p>
                        <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
                            <li>Type <code className="bg-white/10 px-1 rounded">CuSO4·5H2O</code> (or <code className="bg-white/10 px-1 rounded">CuSO4.5H2O</code>)</li>
                            <li>Press Enter or click Search</li>
                            <li><strong>Result:</strong> 249.69 g/mol</li>
                        </ol>
                    </div>
                </div>
            )
        },
        {
            title: "Dilution Calculator",
            icon: Pipette,
            content: (
                <div className="space-y-4 text-zinc-300">
                    <p>
                        Plan simple dilutions using the <span className="text-indigo-300"><InlineMath math="C_1 V_1 = C_2 V_2" /></span> equation.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-white">Stock (C1):</strong> Enter starting concentration.
                        </li>
                        <li>
                            <strong className="text-white">Target (C2, V2):</strong> Enter desired concentration and final volume.
                        </li>
                        <li>
                            <strong className="text-white">Units:</strong> Automatic conversion (e.g., mM to µM).
                        </li>
                    </ul>
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <h4 className="font-bold text-emerald-400 mb-2">📝 Worked Example</h4>
                        <p className="text-sm">
                            <strong>Goal:</strong> Prepare 50 mL of 100 mM NaCl from a 5 M stock.
                        </p>
                        <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
                            <li>C1 = 5 M (stock concentration)</li>
                            <li>C2 = 100 mM (target concentration)</li>
                            <li>V2 = 50 mL (final volume)</li>
                            <li><strong>Result:</strong> V1 = 1 mL of stock + 49 mL buffer</li>
                        </ol>
                    </div>
                </div>
            )
        },
        {
            title: "Molarity Triangle",
            icon: Scale,
            content: (
                <div className="space-y-4 text-zinc-300">
                    <div>
                        Solve for any variable in the relationship:
                        <div className="mt-2 text-indigo-300">
                            <BlockMath math="\text{Mass} = \text{Concentration} \times \text{Volume} \times \text{MW}" />
                        </div>
                    </div>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Select which variable to calculate (Mass, Volume, or Concentration).</li>
                        <li>Fill in the other three values.</li>
                    </ul>
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <h4 className="font-bold text-emerald-400 mb-2">📝 Worked Example</h4>
                        <p className="text-sm">
                            <strong>Goal:</strong> How many grams of NaCl for 500 mL of 1 M solution?
                        </p>
                        <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
                            <li>Set "Solve for: Mass"</li>
                            <li>MW = 58.44 g/mol (or type "NaCl" to auto-lookup)</li>
                            <li>Concentration = 1 M, Volume = 500 mL</li>
                            <li><strong>Result:</strong> Mass = 29.22 g</li>
                        </ol>
                    </div>
                </div>
            )
        },
        {
            title: "Buffer Calculator & Builder",
            icon: Calculator,
            content: (
                <div className="space-y-4 text-zinc-300">
                    <p>
                        Create complex recipes for buffers with multiple components.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-white">Buffer Calculator:</strong> Choose a buffer system (Tris, HEPES, PBS), set target pH and concentration. Get exact amounts of acid/base forms.
                        </li>
                        <li>
                            <strong className="text-white">Recipe Builder:</strong> Add multiple solutes, define concentrations, set total volume. Calculates how much to weigh.
                        </li>
                        <li>
                            <strong className="text-white">Export to PDF:</strong> Print your recipe as a checklist.
                        </li>
                    </ul>
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <h4 className="font-bold text-emerald-400 mb-2">📝 Worked Example: 50 mM Tris pH 7.5</h4>
                        <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
                            <li>Select "Tris" buffer, Method: "Salt Mix"</li>
                            <li>Target pH = 7.5, Concentration = 50 mM, Volume = 1 L</li>
                            <li>Click "Calculate"</li>
                            <li><strong>Result:</strong> ~2.42 g Tris Base + ~4.14 g Tris HCl</li>
                            <li>Click "Export to Recipe Builder" to transfer</li>
                        </ol>
                    </div>
                </div>
            )
        },
        {
            title: "Stock Buffers",
            icon: Beaker,
            content: (
                <div className="space-y-4 text-zinc-300">
                    <p>
                        Manage your inventory of common stock solutions to speed up recipe building.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-white">Add Stocks:</strong> Define name, concentration, and optional volume.
                        </li>
                        <li>
                            <strong className="text-white">Auto-Lookup:</strong> Type a chemical name to fetch Formula and MW from PubChem.
                        </li>
                        <li>
                            <strong className="text-white">Integration:</strong> Saved stocks can be referenced when building recipes.
                        </li>
                    </ul>
                    <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <h4 className="font-bold text-amber-400 mb-2">💡 Tips</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            <li>Save your most-used stocks (e.g., 5M NaCl, 1M HCl, 10X PBS) for quick access.</li>
                            <li>Use the Dilution Calculator to figure out how much stock to add to a recipe.</li>
                        </ul>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
            >
                <div className="p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-sm">
                    <div className="flex items-start gap-6">
                        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hidden sm:block">
                            <BookOpen className="h-8 w-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">How to use MolWeight Pro</h2>
                            <p className="text-zinc-400 leading-relaxed text-lg">
                                This suite of tools is designed to help you speed up common laboratory calculations.
                                Select a tool from the sidebar to get started, or read below for specific instructions on each calculator.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sections.map((section, idx) => {
                        const Icon = section.icon;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-zinc-800 text-indigo-400">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{section.title}</h3>
                                </div>
                                <div className="text-sm leading-relaxed">
                                    {section.content}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="p-6 rounded-2xl bg-indigo-900/20 border border-indigo-500/20">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-indigo-400" />
                        Pro Tip
                    </h3>
                    <p className="text-zinc-300">
                        You can carry values between calculators! If you calculate the Molecular Weight of a compound in the
                        <strong className="text-white mx-1">MW Calculator</strong>,
                        try switching to the <strong className="text-white mx-1">Dilution</strong> tab
                        — the MW might be waiting for you there if you linked it.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
