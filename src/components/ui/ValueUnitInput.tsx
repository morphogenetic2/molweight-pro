"use client";

import { getUnitLabel, parseValueWithUnit } from "@/lib/chemistry/units";

type UnitChangeSource = "select" | "parsed";

interface ValueUnitInputProps {
    value: string | number;
    unit: string;
    onValueChange: (val: string) => void;
    onUnitChange: (unit: string, source: UnitChangeSource) => void;
    options: string[]; // List of unit keys
    isOptionDisabled?: (unit: string) => boolean;
    label?: string;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    selectClassName?: string;
    wrapperClassName?: string;
    readOnlyInput?: boolean;
}

export function ValueUnitInput({
    value,
    unit,
    onValueChange,
    onUnitChange,
    options,
    isOptionDisabled,
    label,
    disabled = false,
    readOnlyInput = false,
    placeholder = "0.00",
    className = "",
    inputClassName = "",
    selectClassName = "",
    wrapperClassName = ""
}: ValueUnitInputProps) {
    return (
        <div className={`space-y-1 ${className}`}>
            {label && <label className="text-xs font-bold text-zinc-500 uppercase">{label}</label>}
            <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''} ${wrapperClassName}`}>
                <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = parseValueWithUnit(raw, options);
                        onValueChange(raw);
                        if (parsed.unit && parsed.unit !== unit) {
                            onUnitChange(parsed.unit, "parsed");
                        }
                    }}
                    onBlur={(e) => {
                        const raw = e.target.value;
                        const parsed = parseValueWithUnit(raw, options);
                        if (parsed.unit && parsed.unit !== unit) {
                            onUnitChange(parsed.unit, "parsed");
                        }
                        if (parsed.value !== "" && Number.isFinite(parseFloat(parsed.value))) {
                            onValueChange(parsed.value);
                        } else {
                            onValueChange(raw.trim());
                        }
                    }}
                    disabled={disabled || readOnlyInput}
                    placeholder={placeholder}
                    className={`min-w-0 flex-1 bg-transparent border-none text-lg font-mono focus:ring-0 p-0 text-white ${inputClassName} ${readOnlyInput ? 'cursor-default' : ''}`}
                />

                <select
                    value={unit}
                    onChange={(e) => onUnitChange(e.target.value, "select")}
                    disabled={disabled}
                    className={`bg-transparent border-none text-sm text-zinc-500 focus:ring-0 cursor-pointer hover:text-zinc-300 min-w-[3rem] text-right ${selectClassName}`}
                >
                    {options.map((opt) => (
                        <option key={opt} value={opt} disabled={isOptionDisabled?.(opt)} className="bg-zinc-900">
                            {getUnitLabel(opt)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
