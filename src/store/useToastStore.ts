"use client";

import { create } from "zustand";
import { createId } from "@/lib/id";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
    id: string;
    message: string;
    tone: ToastTone;
}

interface ToastState {
    toasts: Toast[];
    push: (message: string, tone?: ToastTone, durationMs?: number) => void;
    remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    push: (message, tone = "info", durationMs = 2800) => {
        const id = createId();
        set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
        setTimeout(() => {
            get().remove(id);
        }, durationMs);
    },
    remove: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));
