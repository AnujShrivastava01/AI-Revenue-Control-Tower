"use client";

import { motion } from "framer-motion";

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="hero-dot-field absolute inset-[-12%]"
        animate={{ backgroundPosition: ["0 0", "30px 18px", "0 0"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="hero-soft-light absolute inset-0" />
    </div>
  );
}
