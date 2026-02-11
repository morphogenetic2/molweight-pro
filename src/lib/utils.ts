/**
 * @file utils.ts
 * @description General utility functions for the application.
 * Currently contains Tailwind CSS class name merging utility.
 * @module lib/utils
 * @version 1.0.0
 * @since 2025-01-01
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names with proper conflict resolution.
 *
 * Combines clsx for conditional class names with tailwind-merge to handle
 * conflicting Tailwind utility classes (e.g., "px-2 px-4" resolves to "px-4").
 *
 * @param {...ClassValue[]} inputs - Class names, objects, or arrays to merge
 * @returns {string} Merged class name string with conflicts resolved
 *
 * @example
 * cn("px-2 py-1", "px-4")
 * // Returns: "py-1 px-4" (px-4 overrides px-2)
 *
 * @example
 * cn("text-red-500", isError && "font-bold", ["bg-white", "rounded"])
 * // Returns: "text-red-500 font-bold bg-white rounded" (if isError is true)
 *
 * @since 1.0.0
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
