"use client";

import { motion, Variants } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function Hero() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 },
    },
  };

  return (
    <section className="relative pt-32 pb-20 overflow-hidden px-5 lg:px-8 max-w-6xl mx-auto flex flex-col items-center text-center">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl flex flex-col items-center z-10"
      >
        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 shadow-sm backdrop-blur-md">
          <ShieldCheck size={14} className="text-accent" />
          <span className="text-xs font-medium text-ink-2">Next-generation financial operations</span>
        </motion.div>

        <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.03em] text-ink leading-[1.05]">
          See financial problems before they become <span className="text-accent">losses.</span>
        </motion.h1>

        <motion.p variants={itemVariants} className="mt-6 max-w-2xl text-lg sm:text-xl text-ink-3 leading-relaxed tracking-[-0.01em]">
          An operating layer that continuously reads your payment ledger, investigates anomalies, prices interventions, and takes bounded, human-approved action.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/command-center"
            className="group inline-flex h-12 items-center gap-2 rounded-md bg-ink px-6 text-[15px] font-medium text-surface transition-all hover:bg-ink-2 hover:shadow-pop"
          >
            Enter Control Tower
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-surface border border-line-strong px-6 text-[15px] font-medium text-ink transition-all hover:bg-raised hover:border-ink-4"
          >
            See how it works
          </a>
        </motion.div>
      </motion.div>

      {/* Subtle Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[100px] pointer-events-none -z-10" />
    </section>
  );
}
