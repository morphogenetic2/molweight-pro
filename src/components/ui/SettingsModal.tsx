"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { X, Trash2, Info, ShieldCheck, Database, Search, Loader2, FlaskConical, Plus } from "@/lib/icons";
import { motion, AnimatePresence } from "framer-motion";
import { APP_VERSION } from "@/lib/appMeta";
import { lookupPubChem } from "@/lib/api";

export function SettingsModal() {
    const { 
        isSettingsOpen, 
        setIsSettingsOpen, 
        resetStore, 
        moleculeSettings, 
        updateMoleculeSettings,
        liquidDensities,
        upsertLiquidDensity,
        removeLiquidDensity,
    } = useStore();
    const [isDensityModalOpen, setIsDensityModalOpen] = useState(false);
    const [densityQuery, setDensityQuery] = useState("");
    const [densityInput, setDensityInput] = useState("");
    const [lookupResult, setLookupResult] = useState<{ cid: number; name: string; formula: string } | null>(null);
    const [densityLookupError, setDensityLookupError] = useState("");
    const [isDensityLookupLoading, setIsDensityLookupLoading] = useState(false);
    const [densityDrafts, setDensityDrafts] = useState<Record<number, string>>({});
    const [densityDraftErrors, setDensityDraftErrors] = useState<Record<number, string>>({});

    const sortedLiquidDensities = useMemo(
        () => [...liquidDensities].sort((a, b) => a.name.localeCompare(b.name)),
        [liquidDensities]
    );

    const handleDensityLookup = async () => {
        const query = densityQuery.trim();
        if (!query) return;
        setDensityLookupError("");
        setIsDensityLookupLoading(true);
        try {
            const result = await lookupPubChem(query);
            if (!result?.cid) {
                setLookupResult(null);
                setDensityLookupError("No PubChem result with CID for this query.");
                return;
            }
            const cid = Number(result.cid);
            const name = String(result.name ?? query).trim() || query;
            const formula = String(result.formula ?? "").trim();
            setLookupResult({ cid, name, formula });
            const existing = liquidDensities.find((entry) => entry.cid === cid);
            setDensityInput(existing ? String(existing.density) : "");
        } catch (error) {
            console.error("Density lookup failed:", error);
            setLookupResult(null);
            setDensityLookupError("PubChem lookup failed. Please try again.");
        } finally {
            setIsDensityLookupLoading(false);
        }
    };

    const handleSaveLookupEntry = () => {
        if (!lookupResult) return;
        const parsedDensity = Number.parseFloat(densityInput.trim());
        if (!Number.isFinite(parsedDensity) || parsedDensity <= 0) {
            setDensityLookupError("Density must be a positive number in g/mL.");
            return;
        }
        upsertLiquidDensity({
            cid: lookupResult.cid,
            name: lookupResult.name,
            density: parsedDensity,
        });
        setDensityLookupError("");
        setDensityInput(parsedDensity.toString());
    };

    const handleDraftDensityBlur = (cid: number) => {
        const draft = densityDrafts[cid];
        if (draft === undefined) return;
        const parsed = Number.parseFloat(draft.trim());
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setDensityDraftErrors((prev) => ({ ...prev, [cid]: "Invalid density" }));
            return;
        }
        const existing = liquidDensities.find((entry) => entry.cid === cid);
        if (!existing) return;
        upsertLiquidDensity({
            cid,
            name: existing.name,
            density: parsed,
        });
        setDensityDraftErrors((prev) => {
            const next = { ...prev };
            delete next[cid];
            return next;
        });
    };

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
                    className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                >
                    <div className="px-6 py-4 sm:px-8 sm:py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
                        <div className="flex items-center gap-3">
                            <SettingsIcon className="h-5 w-5 text-emerald-400" />
                            <h2 className="text-lg sm:text-xl font-bold italic tracking-tight">Settings</h2>
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 sm:p-8 space-y-8 overflow-y-auto contents-scrollbar">
                        {/* Section: Molecule Rendering */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <Database className="h-4 w-4" />
                                <h3 className="text-sm font-bold uppercase tracking-widest text-[#6366f1]">Rendering (2D)</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="glass-card p-4 space-y-4 border-white/5">
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-zinc-400 font-medium tracking-tight">Bond Thickness</span>
                                                <span className="text-emerald-400 font-mono">{moleculeSettings.bondThickness}</span>
                                            </div>
                                            <input 
                                                type="range" min="0.5" max="3" step="0.1"
                                                value={moleculeSettings.bondThickness}
                                                onChange={(e) => updateMoleculeSettings({ bondThickness: parseFloat(e.target.value) })}
                                                className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-zinc-400 font-medium tracking-tight">Bond Length</span>
                                                <span className="text-emerald-400 font-mono">{moleculeSettings.bondLength}px</span>
                                            </div>
                                            <input 
                                                type="range" min="10" max="40" step="1"
                                                value={moleculeSettings.bondLength}
                                                onChange={(e) => updateMoleculeSettings({ 
                                                    bondLength: parseInt(e.target.value),
                                                    bondSpacing: 0.18 * parseInt(e.target.value) 
                                                })}
                                                className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-zinc-400 font-medium tracking-tight">Font Size</span>
                                                <span className="text-emerald-400 font-mono">{moleculeSettings.fontSizeLarge}pt</span>
                                            </div>
                                            <input 
                                                type="range" min="6" max="18" step="1"
                                                value={moleculeSettings.fontSizeLarge}
                                                onChange={(e) => updateMoleculeSettings({ 
                                                    fontSizeLarge: parseInt(e.target.value),
                                                    fontSizeSmall: Math.max(5, parseInt(e.target.value) - 3)
                                                })}
                                                className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-zinc-400 font-medium tracking-tight">Max Render Size</span>
                                                <span className="text-emerald-400 font-mono">
                                                    {Math.min(400, moleculeSettings.maxRenderSize ?? 320)}px
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="180"
                                                max="400"
                                                step="10"
                                                value={Math.min(400, moleculeSettings.maxRenderSize ?? 320)}
                                                onChange={(e) =>
                                                    updateMoleculeSettings({
                                                        maxRenderSize: parseInt(e.target.value),
                                                    })
                                                }
                                                className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button 
                                            onClick={() => updateMoleculeSettings({ terminalCarbons: !moleculeSettings.terminalCarbons })}
                                            className={`p-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                                                moleculeSettings.terminalCarbons 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-400'
                                            }`}
                                        >
                                            Show Terminal C
                                        </button>
                                        <button 
                                            onClick={() => updateMoleculeSettings({ explicitHydrogens: !moleculeSettings.explicitHydrogens })}
                                            className={`p-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                                                moleculeSettings.explicitHydrogens 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-400'
                                            }`}
                                        >
                                            Show Hydrogens
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section: Liquid Densities */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <FlaskConical className="h-4 w-4" />
                                <h3 className="text-sm font-bold uppercase tracking-widest">Liquid Densities</h3>
                            </div>
                            <div className="glass-card p-4 sm:p-6 border-white/5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-white">Manage CID Density Database</h4>
                                        <p className="text-[10px] sm:text-xs text-zinc-500 leading-relaxed">
                                            Add custom liquid entries by PubChem CID. Buffer Builder will show mass/volume only for substances found in this database.
                                        </p>
                                        <p className="text-[10px] sm:text-xs text-zinc-500">
                                            {sortedLiquidDensities.length} custom entr{sortedLiquidDensities.length === 1 ? "y" : "ies"} configured.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsDensityModalOpen(true)}
                                        className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all text-xs font-bold uppercase tracking-wider"
                                    >
                                        Manage
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Section: Data Management */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <Database className="h-4 w-4" />
                                <h3 className="text-sm font-bold uppercase tracking-widest">Data Management</h3>
                            </div>
                            <div className="glass-card p-4 sm:p-6 border-white/5 bg-red-500/[0.02]">
                                <div className="flex items-center justify-between gap-4 sm:gap-6">
                                    <div>
                                        <h4 className="font-bold text-white mb-1">Reset Application</h4>
                                        <p className="text-[10px] sm:text-xs text-zinc-500 leading-relaxed">
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
                                        <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20">v{APP_VERSION}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-400">Build ID</span>
                                        <span className="text-[10px] font-mono text-zinc-600">release-{APP_VERSION}</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <a
                                        href="https://github.com/morphogenetic2/molweight-pro"
                                        target="_blank"
                                        className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium text-zinc-300"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" role="img" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg> Github
                                    </a>
                                    <div className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-sm font-medium">
                                        <ShieldCheck className="h-4 w-4" /> Secure App
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {isDensityModalOpen && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                                onClick={() => setIsDensityModalOpen(false)}
                            />
                            <div className="relative w-full max-w-2xl bg-[#0b0b0d] border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
                                <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FlaskConical className="h-4 w-4 text-emerald-300" />
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-300">Liquid Density Manager</h4>
                                    </div>
                                    <button
                                        onClick={() => setIsDensityModalOpen(false)}
                                        className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="p-5 space-y-4 overflow-y-auto contents-scrollbar">
                                    <div className="glass-card p-4 border-white/5 space-y-3">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                                            Search Substance (PubChem)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={densityQuery}
                                                onChange={(event) => setDensityQuery(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" && !isDensityLookupLoading) {
                                                        void handleDensityLookup();
                                                    }
                                                }}
                                                placeholder="e.g. Ethanol, DMSO, Acetonitrile"
                                                className="flex-1"
                                            />
                                            <button
                                                onClick={() => void handleDensityLookup()}
                                                disabled={isDensityLookupLoading || !densityQuery.trim()}
                                                className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                aria-label="Search PubChem"
                                            >
                                                {isDensityLookupLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Search className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>

                                        {lookupResult && (
                                            <div className="grid sm:grid-cols-[1fr_auto] gap-3 border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3">
                                                <div className="text-xs space-y-1">
                                                    <p className="text-emerald-200 font-semibold">{lookupResult.name}</p>
                                                    <p className="text-zinc-400">
                                                        CID: <span className="text-zinc-300 font-mono">{lookupResult.cid}</span>
                                                        {lookupResult.formula ? (
                                                            <>
                                                                {" "}• Formula: <span className="text-zinc-300 font-mono">{lookupResult.formula}</span>
                                                            </>
                                                        ) : null}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={densityInput}
                                                        onChange={(event) => setDensityInput(event.target.value)}
                                                        placeholder="g/mL"
                                                        className="w-24"
                                                    />
                                                    <button
                                                        onClick={handleSaveLookupEntry}
                                                        disabled={!densityInput.trim()}
                                                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {densityLookupError && (
                                            <p className="text-[11px] text-red-300">{densityLookupError}</p>
                                        )}
                                    </div>

                                    <div className="glass-card p-4 border-white/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                                                Custom Entries
                                            </h5>
                                            <span className="text-[11px] text-zinc-500">
                                                {sortedLiquidDensities.length} total
                                            </span>
                                        </div>

                                        {sortedLiquidDensities.length === 0 ? (
                                            <p className="text-xs text-zinc-500 italic">No custom liquid densities yet.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {sortedLiquidDensities.map((entry) => {
                                                    const draftValue = densityDrafts[entry.cid] ?? String(entry.density);
                                                    return (
                                                        <div key={entry.cid} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-zinc-200 truncate">{entry.name}</p>
                                                                <p className="text-[11px] text-zinc-500 font-mono">CID {entry.cid}</p>
                                                            </div>
                                                            <div className="w-28">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    value={draftValue}
                                                                    onChange={(event) =>
                                                                        setDensityDrafts((prev) => ({
                                                                            ...prev,
                                                                            [entry.cid]: event.target.value,
                                                                        }))
                                                                    }
                                                                    onBlur={() => handleDraftDensityBlur(entry.cid)}
                                                                    className="w-full text-sm"
                                                                    aria-label={`Density for ${entry.name}`}
                                                                />
                                                                {densityDraftErrors[entry.cid] && (
                                                                    <p className="text-[10px] text-red-300 mt-1">{densityDraftErrors[entry.cid]}</p>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => removeLiquidDensity(entry.cid)}
                                                                className="p-2 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10 transition-colors"
                                                                title={`Remove ${entry.name}`}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
