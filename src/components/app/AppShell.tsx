"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRightLeft,
  Beaker,
  Calculator,
  FlaskConical,
  HelpCircle,
  History,
  Menu,
  Pipette,
  Scale,
  Settings,
  Table2,
} from "@/lib/icons";
import type { AppIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import type { ActiveTab } from "@/store/storeTypes";
import MWCalculator from "@/components/calculators/MWCalculator";
import DilutionCalculator from "@/components/calculators/DilutionCalculator";
import MolarityCalculator from "@/components/calculators/MolarityCalculator";
import SerialDilutionCalculator from "@/components/calculators/SerialDilutionCalculator";
import BufferBuilder from "@/components/calculators/BufferBuilder";
import BufferCalculator from "@/components/calculators/BufferCalculator";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { RecipeLibrary } from "@/components/ui/RecipeLibrary";
import { SaveRecipeModal } from "@/components/ui/SaveRecipeModal";
import { HelpView } from "@/components/ui/HelpView";
import { StockManager } from "@/components/ui/StockManager";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { MagneticButton } from "@/components/app/MagneticButton";
import { PerpetualStatus } from "@/components/app/PerpetualStatus";

type TabDef = {
  id: ActiveTab;
  label: string;
  icon: AppIcon;
  desc: string;
  badge?: string;
};

const TABS: TabDef[] = [
  { id: "mw", label: "Molecular Weight", icon: Table2, desc: "Compute molar mass from formulas or PubChem." },
  { id: "dilution", label: "Dilution", icon: Pipette, desc: "Run C1V1 to C2V2 planning with linked compounds." },
  { id: "serial_dilution", label: "Serial Dilution", icon: ArrowRightLeft, desc: "Design multi-step series with auto or manual steps." },
  { id: "molarity", label: "Molarity", icon: Scale, desc: "Solve for mass, volume, concentration, or molecular weight." },
  { id: "buffer_calc", label: "Buffer Calculator", icon: Calculator, desc: "Generate titration and salt-mix buffer recipes." },
  { id: "buffer_recipe", label: "Recipe Builder", icon: FlaskConical, desc: "Build and save custom prep plans for repeated use." },
  { id: "stocks", label: "Stock Library", icon: Beaker, desc: "Track stock solutions and concentrations." },
  { id: "help", label: "Guide", icon: HelpCircle, desc: "Reference workflows and usage tips.", badge: "Tips" },
];

const navVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const navItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function LoadingSkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-8 w-2/3 animate-pulse rounded-xl bg-zinc-800/80" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div className="h-44 animate-pulse rounded-[1.75rem] bg-zinc-800/80" />
        <div className="h-44 animate-pulse rounded-[1.75rem] bg-zinc-800/80" />
        <div className="h-44 animate-pulse rounded-[1.75rem] bg-zinc-800/80" />
      </div>
    </section>
  );
}

function ErrorState({ onRecover }: { onRecover: () => void }) {
  return (
    <section className="rounded-[1.75rem] border border-rose-400/45 bg-rose-500/10 p-8">
      <h3 className="text-lg tracking-tight text-rose-200">View failed to render</h3>
      <p className="mt-2 text-sm text-rose-300">Resetting to Molecular Weight usually resolves this state.</p>
      <button
        type="button"
        onClick={onRecover}
        className="mt-5 inline-flex items-center rounded-xl border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-sm text-rose-100 transition active:translate-y-[1px] active:scale-[0.98]"
      >
        Return to Molecular Weight
      </button>
    </section>
  );
}

export function AppShell() {
  const {
    activeTab,
    setActiveTab,
    setIsHistoryOpen,
    setIsSettingsOpen,
    activeRecipeName,
    savedRecipes,
    stocks,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (switchTimerRef.current) {
        window.clearTimeout(switchTimerRef.current);
      }
    },
    [],
  );

  const handleTabChange = (tab: ActiveTab) => {
    setIsSwitching(true);
    if (switchTimerRef.current) {
      window.clearTimeout(switchTimerRef.current);
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
    switchTimerRef.current = window.setTimeout(() => setIsSwitching(false), 240);
  };

  const activeLabel = useMemo(
    () => TABS.find((tab) => tab.id === activeTab)?.label ?? "Molecular Weight",
    [activeTab],
  );

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-55">
        <div className="absolute -left-16 top-[-10%] h-[36rem] w-[36rem] rounded-full bg-emerald-500/16 blur-3xl" />
        <div className="absolute right-[-8%] top-[20%] h-[30rem] w-[30rem] rounded-full bg-emerald-400/12 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1400px] grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[320px_minmax(0,1fr)] md:px-6 lg:px-8">
        <aside className="order-2 rounded-[2.25rem] border border-white/10 bg-zinc-900/70 p-4 shadow-[0_24px_40px_-20px_rgba(5,8,9,0.9)] backdrop-blur-xl md:order-1">
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => handleTabChange("mw")}
              className="inline-flex items-center gap-3 rounded-2xl px-2 py-1 active:translate-y-[1px] active:scale-[0.98]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                <FlaskConical className="h-5 w-5" weight="regular" />
              </span>
              <span className="text-left">
                <strong className="block text-base tracking-tight text-zinc-100">Molar Bench</strong>
                <span className="block text-xs text-zinc-400">lab computation suite</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-zinc-400 md:hidden"
            >
              <Menu className="h-5 w-5" weight="regular" />
            </button>
          </div>

          <motion.nav
            variants={navVariants}
            initial="hidden"
            animate="show"
            className={cn("space-y-2", mobileMenuOpen ? "block" : "hidden md:block")}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  variants={navItemVariants}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "group relative flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all",
                    "active:translate-y-[1px] active:scale-[0.98]",
                    isActive
                      ? "border-emerald-300/40 bg-emerald-500/12 text-zinc-100"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/[0.08]",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" weight="regular" />
                    <span className="text-sm">{tab.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {tab.id === "stocks" && stocks.length > 0 ? (
                      <span className="rounded-full border border-emerald-300/40 bg-emerald-500/12 px-2 py-0.5 text-[10px] text-emerald-300">
                        {stocks.length}
                      </span>
                    ) : null}
                    {tab.id === "buffer_recipe" && savedRecipes.length > 0 ? (
                      <span className="rounded-full border border-emerald-300/40 bg-emerald-500/12 px-2 py-0.5 text-[10px] text-emerald-300">
                        {savedRecipes.length}
                      </span>
                    ) : null}
                    {isActive ? <PerpetualStatus /> : null}
                  </span>
                </motion.button>
              );
            })}
          </motion.nav>
        </aside>

        <main className="order-1 md:order-2">
          <header className="mb-6 grid grid-cols-1 gap-4 rounded-[2.25rem] border border-white/10 bg-zinc-900/65 p-5 backdrop-blur-xl md:grid-cols-[1.2fr_1fr] md:p-8">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
                <PerpetualStatus />
                active workspace
              </p>
              <h1 className="text-4xl tracking-tighter text-zinc-100 md:text-6xl md:leading-none">{activeLabel}</h1>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-400">
                Calibrate molecular workflows, track buffer stock, and run calculations with a single source of lab truth.
              </p>
              {activeTab === "buffer_recipe" && activeRecipeName ? (
                <p className="text-sm text-zinc-300">
                  Current recipe: <span className="font-mono text-emerald-300">{activeRecipeName}</span>
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2">
              <MagneticButton icon={<History className="h-4 w-4" weight="regular" />} onClick={() => setIsHistoryOpen(true)}>
                History
              </MagneticButton>
              <MagneticButton
                icon={<Settings className="h-4 w-4" weight="regular" />}
                onClick={() => setIsSettingsOpen(true)}
                variant="primary"
              >
                Settings
              </MagneticButton>
            </div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={activeTab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="rounded-[2.25rem] border border-white/10 bg-zinc-900/70 p-4 shadow-[0_20px_40px_-22px_rgba(7,10,11,0.85)] backdrop-blur-xl sm:p-6 lg:p-8"
            >
              {isSwitching ? <LoadingSkeleton /> : null}

              {!isSwitching && activeTab === "mw" ? <MWCalculator /> : null}
              {!isSwitching && activeTab === "dilution" ? <DilutionCalculator /> : null}
              {!isSwitching && activeTab === "serial_dilution" ? <SerialDilutionCalculator /> : null}
              {!isSwitching && activeTab === "molarity" ? <MolarityCalculator /> : null}
              {!isSwitching && activeTab === "buffer_calc" ? <BufferCalculator /> : null}
              {!isSwitching && activeTab === "buffer_recipe" ? <BufferBuilder /> : null}
              {!isSwitching && activeTab === "stocks" ? <StockManager /> : null}
              {!isSwitching && activeTab === "help" ? <HelpView /> : null}
              {!isSwitching && !["mw", "dilution", "serial_dilution", "molarity", "buffer_calc", "buffer_recipe", "stocks", "help"].includes(activeTab) ? (
                <ErrorState onRecover={() => handleTabChange("mw")} />
              ) : null}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>

      <HistoryPanel />
      <SettingsModal />
      <RecipeLibrary />
      <SaveRecipeModal />
      <ToastViewport />
    </div>
  );
}
