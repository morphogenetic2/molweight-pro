"use client";

import { getUnitLabel } from "@/lib/chemistry/units";

interface ValueUnitInputProps {
    value: string | number;
    unit: string;
    onValueChange: (val: string) => void;
    onUnitChange: (unit: string) => void;
    options: string[]; // List of unit keys
    label?: string;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    readOnlyInput?: boolean;
}

export function ValueUnitInput({
    value,
    unit,
    onValueChange,
    onUnitChange,
    options,
    label,
    disabled = false,
    readOnlyInput = false,
    placeholder = "0.00",
    className = "",
    inputClassName = ""
}: ValueUnitInputProps) {
    return (
        <div className={`space-y-1 ${className}`}>
            {label && <label className="text-xs font-bold text-zinc-500 uppercase">{label}</label>}
            <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    disabled={disabled || readOnlyInput}
                    placeholder={placeholder}
                    className={`min-w-0 flex-1 bg-transparent border-none text-lg font-mono focus:ring-0 p-0 text-white ${inputClassName} ${readOnlyInput ? 'cursor-default' : ''}`}
                />

                <select
                    value={unit}
                    onChange={(e) => onUnitChange(e.target.value)}
                    disabled={disabled}
                    className="bg-transparent border-none text-sm text-zinc-500 focus:ring-0 cursor-pointer hover:text-zinc-300 min-w-[3rem] text-right"
                >
                    {options.map((opt) => (
                        <option key={opt} value={opt} className="bg-zinc-900">
                            {getUnitLabel(opt)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
