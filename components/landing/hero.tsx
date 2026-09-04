"use client";

import { motion, Variants } from "framer-motion";
import { ArrowRight, ShieldCheck, Activity } from "lucide-react";
import Link from "next/link";
import { StatusDot } from "@/components/ui/primitives";

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

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 80, damping: 25 }}
        className="mt-20 w-full rounded-xl border border-line bg-surface shadow-pop overflow-hidden relative z-10"
      >
        {/* Gradient fade at bottom to blend with next section */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent z-20 pointer-events-none" />
        
        {/* Mock Window Header */}
        <div className="flex h-12 items-center gap-2 border-b border-line bg-raised px-4">
          <div className="h-3 w-3 rounded-full bg-line-strong/80" />
          <div className="h-3 w-3 rounded-full bg-line-strong/80" />
          <div className="h-3 w-3 rounded-full bg-line-strong/80" />
          <div className="ml-4 flex-1 flex justify-center">
            <div className="h-6 w-56 rounded border border-line bg-surface flex items-center justify-center shadow-card">
              <span className="text-[10px] text-ink-3 tracking-[0.05em] font-mono uppercase font-medium">control-tower.razorpay.app</span>
            </div>
          </div>
        </div>
        
        {/* Mock UI Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 h-[440px]">
          <div className="hidden md:flex flex-col border-r border-line bg-canvas p-4 gap-4">
             <div className="h-8 rounded bg-line-strong/30 w-full animate-pulse" />
             <div className="h-8 rounded bg-line w-3/4" />
             <div className="h-8 rounded bg-line w-5/6" />
             <div className="h-8 rounded bg-line w-2/3" />
             <div className="mt-auto h-24 rounded border border-line bg-surface p-4 shadow-card">
               <div className="text-[10px] text-ink-3 font-semibold uppercase tracking-wider">System Status</div>
               <div className="mt-3 flex items-center gap-2">
                 <Activity size={16} className="text-ok" />
                 <span className="text-xs font-medium text-ink-2">Processing normal</span>
               </div>
               <div className="mt-2 text-2xs text-ink-4 font-mono">Lat: 42ms</div>
             </div>
          </div>
          <div className="col-span-3 p-8 flex flex-col gap-6 bg-surface hairline-grid">
             <div className="flex justify-between items-start">
               <div>
                 <div className="text-4xl font-semibold tracking-tight text-ink tnum">₹8,42,000</div>
                 <div className="text-xs font-medium text-ink-3 uppercase tracking-wider mt-1.5 flex items-center gap-2">
                   Revenue at risk <StatusDot tone="warn" pulse />
                 </div>
               </div>
               <div className="h-8 px-3 bg-accent-soft rounded border border-accent/20 flex items-center justify-center">
                 <span className="text-xs font-semibold text-accent">3 Anomalies Detected</span>
               </div>
             </div>
             
             {/* Mock Chart/Table area */}
             <div className="flex-1 rounded-lg border border-line bg-canvas flex flex-col justify-between p-5 overflow-hidden relative shadow-card">
               <div className="flex justify-between w-full mb-6 border-b border-line pb-4">
                 <div className="h-4 w-32 bg-line-strong rounded-sm" />
                 <div className="h-4 w-20 bg-line rounded-sm" />
               </div>
               
               <div className="space-y-3">
                 {[
                   { color: "bg-danger", w1: "w-48", w2: "w-24" },
                   { color: "bg-warn", w1: "w-32", w2: "w-20" },
                   { color: "bg-warn", w1: "w-36", w2: "w-16" }
                 ].map((item, i) => (
                   <motion.div 
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: 0.8 + (i * 0.1) }}
                     key={i} 
                     className="h-14 w-full bg-surface rounded-md border border-line shadow-card flex items-center px-4 justify-between group hover:border-line-strong transition-colors"
                   >
                     <div className="flex gap-4 items-center">
                       <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                       <div className={`h-3 ${item.w1} bg-line-strong rounded-sm`} />
                     </div>
                     <div className={`h-3 ${item.w2} bg-line rounded-sm`} />
                   </motion.div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      </motion.div>
      
      {/* Subtle Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[100px] pointer-events-none -z-10" />
    </section>
  );
}
