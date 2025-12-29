"use client";

import { useStore } from "@/store/useStore";
import { DEFAULT_RECIPES, Recipe } from "@/lib/recipes";
import { X, Book, Trash2, ChevronRight, Info, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FormulaBadge } from "./FormulaBadge";

export function RecipeLibrary() {
    const {
        isRecipeLibraryOpen, setIsRecipeLibraryOpen,
        savedRecipes, deleteRecipe, loadRecipe
    } = useStore();

    if (!isRecipeLibraryOpen) return null;

    const allRecipes = [
        ...DEFAULT_RECIPES.map(r => ({ ...r, isDefault: true })),
        ...savedRecipes.map(r => ({ ...r, isDefault: false }))
    ];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsRecipeLibraryOpen(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                >
                    <div className="px-6 py-4 sm:px-8 sm:py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <Book className="h-5 w-5 text-indigo-400" />
                            <h2 className="text-lg sm:text-xl font-bold italic tracking-tight">Recipe Library</h2>
                        </div>
                        <button
                            onClick={() => setIsRecipeLibraryOpen(false)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allRecipes.map((recipe) => (
                            <div
                                key={recipe.id}
                                className="group relative glass-card p-5 border-white/5 hover:border-indigo-500/30 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                {recipe.name}
                                            </span>
                                            {recipe.isDefault && (
                                                <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 w-fit">
                                                    STANDARD
                                                </span>
                                            )}
                                        </div>
                                        {!recipe.isDefault && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteRecipe(recipe.id);
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-4">
                                        {recipe.description}
                                    </p>

                                    <div className="flex flex-wrap gap-1.5 mb-4 opacity-70">
                                        {recipe.solutes.slice(0, 3).map((s, idx) => (
                                            <span key={idx} className="text-[10px] font-mono text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                {s.name || "?"}
                                            </span>
                                        ))}
                                        {recipe.solutes.length > 3 && (
                                            <span className="text-[10px] font-mono text-zinc-600 px-1.5 py-0.5">
                                                +{recipe.solutes.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        loadRecipe(recipe);
                                        setIsRecipeLibraryOpen(false);
                                    }}
                                    className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-400 transition-all flex items-center justify-center gap-2 group/btn"
                                >
                                    Load Recipe
                                    <ChevronRight className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <Info className="h-3.5 w-3.5" />
                            <span>Loading a recipe will clear your current workspace.</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
