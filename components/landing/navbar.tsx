"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { StatusDot } from "@/components/ui/primitives";

interface NavbarProps {
  mode: "test" | "live" | "mock" | string;
}

export function Navbar({ mode }: NavbarProps) {
  const { scrollY } = useScroll();
  
  // Animate border and background based on scroll
  const borderOpacity = useTransform(scrollY, [0, 50], [0, 1]);
  const bgOpacity = useTransform(scrollY, [0, 50], [0, 0.8]);
  
  return (
    <motion.header 
      className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between px-5 lg:px-8"
      style={{
        backgroundColor: useTransform(bgOpacity, v => `rgba(255, 255, 255, ${v})`),
        backdropFilter: useTransform(bgOpacity, v => v > 0 ? "blur(12px)" : "none"),
        borderBottom: useTransform(borderOpacity, v => `1px solid rgba(231, 233, 236, ${v})`) // --line
      }}
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-surface">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <path d="M3 9h18"/>
              <path d="M9 21V9"/>
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink hidden sm:inline-block">
            Control Tower
          </span>
        </Link>
        <span className="hidden items-center gap-2 text-2xs uppercase tracking-[0.1em] text-ink-3 md:flex bg-raised px-2.5 py-1 rounded-full border border-line">
          <StatusDot tone={mode === "test" ? "ok" : "warn"} pulse />
          {mode === "test" ? "Live test mode" : "Demo — synthetic data"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/command-center"
          className="group inline-flex h-8 items-center gap-2 rounded-full bg-ink px-4 text-xs font-medium text-surface transition-all hover:bg-ink-2 hover:shadow-pop"
        >
          Enter App
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.header>
  );
}
