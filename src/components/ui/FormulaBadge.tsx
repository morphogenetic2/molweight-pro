import React from "react";
import { cn } from "@/lib/utils";

interface FormulaBadgeProps {
    formula: string;
    className?: string;
}

export function FormulaBadge({ formula, className }: FormulaBadgeProps) {
    // Use regex to find letters followed by numbers
    const parts = formula.split(/(\d+)/);

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
            className
        )}>
            {parts.map((part, i) => {
                if (/^\d+$/.test(part)) {
                    return <sub key={i} className="bottom-[-0.2em] text-[0.8em]">{part}</sub>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
}
