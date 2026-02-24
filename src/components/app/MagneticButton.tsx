"use client";

import type { ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type MagneticButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  icon?: ReactNode;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

const MAX_PULL = 8;

export function MagneticButton({
  icon,
  children,
  className,
  variant = "secondary",
  onMouseMove,
  onMouseLeave,
  ...props
}: MagneticButtonProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tx = useTransform(x, (latest) => latest);
  const ty = useTransform(y, (latest) => latest);

  return (
    <motion.button
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const nextX = ((event.clientX - rect.left) / rect.width - 0.5) * (MAX_PULL * 2);
        const nextY = ((event.clientY - rect.top) / rect.height - 0.5) * (MAX_PULL * 2);
        x.set(nextX);
        y.set(nextY);
        onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        x.set(0);
        y.set(0);
        onMouseLeave?.(event);
      }}
      style={{ x: tx, y: ty }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium tracking-tight",
        "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "active:translate-y-[1px] active:scale-[0.98]",
        variant === "primary"
          ? "border-emerald-300/40 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
          : "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/[0.08]",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </motion.button>
  );
}
