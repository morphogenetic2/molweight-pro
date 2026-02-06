import React from "react";
import { cn } from "@/lib/utils";
import { normalizeFormula } from "@/lib/parser";

interface FormulaBadgeProps {
    formula: string;
    className?: string;
}

export function FormulaBadge({ formula, className }: FormulaBadgeProps) {
    // 1. Normalize for display (standardize dots, strips junk)
    const normalized = normalizeFormula(formula, true);
    
    // 2. Split by numbers (including decimals) and our standardized middle dot
    const parts = normalized.split(/(\d+\.\d+|\d+|·)/);

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
            className
        )}>
            {parts.map((part, i) => {
                if (!part) return null;

                // Handle numbers (including those with decimal points)
                if (/^(\d+\.\d+|\d+)$/.test(part)) {
                    // It's a multiplier if it's the first part or follows a separator
                    const prevPart = i > 0 ? parts[i - 1] : null;
                    const isMultiplier = !prevPart || prevPart === "·";

                    if (isMultiplier) {
                        return <span key={i}>{part}</span>;
                    }
                    return <sub key={i} className="bottom-[-0.2em] text-[0.8em]">{part}</sub>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
}
