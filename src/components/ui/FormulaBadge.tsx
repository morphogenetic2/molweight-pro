import React from "react";
import { cn } from "@/lib/utils";

interface FormulaBadgeProps {
    formula: string;
    className?: string;
}

export function FormulaBadge({ formula, className }: FormulaBadgeProps) {
    // Use regex to find letters followed by numbers
    // Regex to split by numbers and common hydrate separators
    const parts = formula.split(/(\d+|[·*•.])/);

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
            className
        )}>
            {parts.map((part, i) => {
                if (!part) return null;

                if (/^\d+$/.test(part)) {
                    // It's a multiplier if it's the first part or follows a separator
                    const prevPart = i > 0 ? parts[i - 1] : null;
                    const isMultiplier = !prevPart || /^[·*•.]$/.test(prevPart);

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
