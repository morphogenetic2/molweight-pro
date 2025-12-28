"use client";

import { useState } from "react";
import {
    FlaskConical,
    Pipette,
    Table2,
    History,
    Settings,
    Menu,
    ChevronRight,
    Search,
    Printer,
    Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

// Component imports
import MWCalculator from "@/components/calculators/MWCalculator";
import DilutionCalculator from "@/components/calculators/DilutionCalculator";
import BufferBuilder from "@/components/calculators/BufferBuilder";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { RecipeLibrary } from "@/components/ui/RecipeLibrary";
import { SaveRecipeModal } from "@/components/ui/SaveRecipeModal";

const TABS = [
    { id: "mw", label: "Molecular Weight", icon: Table2 },
    { id: "dilution", label: "Dilution Calc", icon: Pipette },
    { id: "buffer", label: "Buffer Recipe", icon: FlaskConical },
] as const;

export default function Home() {
    const {
        activeTab, setActiveTab,
        setIsHistoryOpen, setIsSettingsOpen,
        setIsRecipeLibraryOpen, setIsSaveRecipeOpen,
        activeRecipeName
    } = useStore();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex h-screen overflow-hidden bg-[#050505] text-white">
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 280 : 80 }}
                className="relative z-20 flex flex-col border-r border-white/5 bg-[#0a0a0a]"
            >
                <div className="flex h-20 items-center px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
                            <FlaskConical className="h-6 w-6" />
                        </div>
                        {sidebarOpen && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-lg font-bold tracking-tight"
                            >
                                MolWeight <span className="text-indigo-500">Pro</span>
                            </motion.span>
                        )}
                    </div>
                </div>

                <nav className="flex-1 space-y-2 px-3 pt-4">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setActiveTab(tab.id as "mw" | "dilution" | "buffer");
                                }}
                                className={cn(
                                    "group relative flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all",
                                    isActive
                                        ? "bg-indigo-600/10 text-indigo-400"
                                        : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive ? "text-indigo-500" : "group-hover:text-zinc-300")} />
                                {sidebarOpen && <span>{tab.label}</span>}
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill"
                                        className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-indigo-500"
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="flex h-10 w-full items-center justify-center rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-zinc-500"
                    >
                        <Menu className="h-4 w-4" />
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="relative flex-1 overflow-y-auto p-8">
                {/* Background Gradients */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
                    <div className="absolute top-[20%] -right-[10%] h-[30%] w-[30%] rounded-full bg-blue-600/10 blur-[100px]" />
                </div>

                <header className="mb-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {TABS.find(t => t.id === activeTab)?.label}
                            {activeTab === "buffer" && activeRecipeName && (
                                <span className="ml-3 inline-flex items-center rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-400">
                                    {activeRecipeName}
                                </span>
                            )}
                        </h1>
                        <p className="mt-1 text-zinc-500">
                            Professional chemical tools for precision laboratory work.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="secondary flex items-center gap-2"
                        >
                            <History className="h-4 w-4" />
                            History
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="primary flex items-center gap-2"
                        >
                            <Settings className="h-4 w-4" />
                            Settings
                        </button>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === "mw" && (
                            <MWCalculator />
                        )}

                        {activeTab === "dilution" && (
                            <DilutionCalculator />
                        )}

                        {activeTab === "buffer" && (
                            <BufferBuilder />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            <HistoryPanel />
            <SettingsModal />
            <RecipeLibrary />
            <SaveRecipeModal />
        </div>
    );
}
