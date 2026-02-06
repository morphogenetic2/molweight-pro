"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useToastStore } from "@/store/useToastStore";
import type { ToastTone } from "@/store/useToastStore";

const toneStyles: Record<ToastTone, { bg: string; text: string; icon: JSX.Element }> = {
    success: {
        bg: "bg-emerald-500/15 border-emerald-500/30",
        text: "text-emerald-300",
        icon: <CheckCircle2 className="h-4 w-4" />
    },
    error: {
        bg: "bg-red-500/15 border-red-500/30",
        text: "text-red-300",
        icon: <AlertTriangle className="h-4 w-4" />
    },
    info: {
        bg: "bg-indigo-500/15 border-indigo-500/30",
        text: "text-indigo-300",
        icon: <Info className="h-4 w-4" />
    }
};

export function ToastViewport() {
    const { toasts, remove } = useToastStore();

    return (
        <div
            className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(90vw,360px)]"
            role="status"
            aria-live="polite"
        >
            <AnimatePresence initial={false}>
                {toasts.map((toast) => {
                    const style = toneStyles[toast.tone];
                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur ${style.bg} ${style.text}`}
                            onClick={() => remove(toast.id)}
                        >
                            {style.icon}
                            <span className="flex-1">{toast.message}</span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
