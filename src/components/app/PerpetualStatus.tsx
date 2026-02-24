"use client";

import { memo } from "react";
import { motion } from "framer-motion";

export const PerpetualStatus = memo(function PerpetualStatus() {
  return (
    <motion.span
      aria-hidden
      className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"
      animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1, 0.9] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
});
