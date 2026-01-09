
import { motion } from "framer-motion";
import {
    Table2,
    Pipette,
    Scale,
    Calculator,
    FlaskConical,
    BookOpen,
    ArrowRight
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
                            <strong className="text-white">Chemical Formulas:</strong> Type standard formulas like <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">H2SO4</code> or <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">CuSO4·5H2O</code>. You can use * and . to indicate hydration states or complexes. For example, <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">H2SO4*2H2O</code> or <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">CuSO4.5H2O</code>.
                        </li>
                        <li>
                            <strong className="text-white">Common Names:</strong> Type a name like "Aspirin" or "Ethanol". The app will use the PubChem API to find the structure and weight. It supports many synonyms and common names.
                        </li>
                        <li>
                            <strong className="text-white">History:</strong> Successful calculations are saved to your history (bottom right clock icon) for quick access later.
                        </li>
                    </ul>
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
                            <strong className="text-white">Stock (Source):</strong> Enter your starting concentration (<InlineMath math="C_1" />).
                        </li>
                        <li>
                            <strong className="text-white">Target (Destination):</strong> Enter your desired concentration (<InlineMath math="C_2" />) and final volume (<InlineMath math="V_2" />).
                        </li>
                        <li>
                            <strong className="text-white">Units:</strong> The calculator handles unit conversions automatically (e.g., mM to µM).
                        </li>
                        <li>
                            <strong className="text-white">Stock reagents:</strong> You can calculate the dilution required for a reagent if you are building a recipe (i.e. you have a stock at 2M and want to dilute it to 20 mM for a buffer) and then add it to the recipe builder to simplify the calculations.
                        </li>
                    </ul>
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
                        <li>
                            Select which variable you want to calculate (Mass, Volume, or Concentration).
                        </li>
                        <li>
                            Fill in the other three values.
                        </li>
                        <li>
                            For example, find out how many grams of NaCl (MW ~58.44) you need to make 500mL of a 1M solution.
                        </li>
                    </ul>
                </div>
            )
        },
        {
            title: "Buffer Calculator & Builder",
            icon: Calculator,
            content: (
                <div className="space-y-4 text-zinc-300">
                    <p>
                        Create complex recipes for buffers with multiple components (like PBS or TAE).
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-white">Recipe Builder:</strong> Add multiple solutes (Tris, EDTA, NaCl), define their target concentrations, and set a total volume.
                        </li>
                        <li>
                            <strong className="text-white">Auto-Math:</strong> The app calculates exactly how much mass of each solute you need to weigh out.
                        </li>
                        <li>
                            <strong className="text-white">Save Recipes:</strong> Save your custom buffer recipes to your library for repeated use.
                        </li>
                    </ul>
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
