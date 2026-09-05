"use client";

import { Fragment } from "react";
import { motion, Variants } from "framer-motion";
import { ArrowRight, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { Badge, Panel, StatusDot } from "@/components/ui/primitives";
import { HeroBackground } from "./hero-background";

const FLOW = ["Observe", "Investigate", "Decide", "Approve", "Act", "Verify"];

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
    <section className="relative pt-32 pb-24 overflow-hidden px-5 lg:px-8 max-w-6xl mx-auto flex flex-col items-center text-center">
      <HeroBackground />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl flex flex-col items-center z-10"
      >
        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 shadow-sm backdrop-blur-md">
          <StatusDot tone="danger" pulse />
          <span className="text-xs font-medium text-ink-2">Payment anomaly detected · ₹4.82L at risk</span>
        </motion.div>

        <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.03em] text-ink leading-[1.05]">
          When payments fail,
          <br />
          know why and what&apos;s <span className="text-accent">next.</span>
        </motion.h1>

        <motion.p variants={itemVariants} className="mt-6 max-w-2xl text-lg sm:text-xl text-ink-3 leading-relaxed tracking-[-0.01em]">
          Financial Control Tower detects payment anomalies, proves the cause, models
          recovery options, and asks for approval before acting.
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
            href="#demo"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-surface border border-line-strong px-6 text-[15px] font-medium text-ink transition-all hover:bg-raised hover:border-ink-4"
          >
            Watch one incident get resolved
          </a>
        </motion.div>

        <motion.p variants={itemVariants} className="mt-5 text-xs text-ink-4 tnum">
          10,000 test transactions · Razorpay test mode · No real money moves
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 90, damping: 22 }}
        className="mt-14 w-full max-w-xl z-10"
      >
        <Panel className="overflow-hidden text-left">
          <div className="h-[2px] w-full bg-danger" aria-hidden />
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge tone="danger">Critical</Badge>
              <span className="font-mono text-[11px] text-ink-4 tnum">14:32 IST</span>
            </div>

            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              UPI degradation detected
            </h3>
            <p className="mt-1 text-[13px] text-ink-3">
              Success rate <span className="font-medium text-ink tnum">97.8% → 81.4%</span>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <div>
                <div className="eyebrow mb-1">Revenue at risk</div>
                <div className="text-[19px] font-semibold text-danger tnum">₹4.82L</div>
              </div>
              <div>
                <div className="eyebrow mb-1">Affected payments</div>
                <div className="text-[19px] font-semibold text-ink tnum">1,284</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Badge tone="accent">Recommended: Retry first</Badge>
              <Badge tone="neutral">
                <Lock size={10} strokeWidth={2} />
                Human approval required
              </Badge>
            </div>
          </div>
        </Panel>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
          {FLOW.map((stage, i) => (
            <Fragment key={stage}>
              <span className="text-xs font-medium text-ink-3">{stage}</span>
              {i < FLOW.length - 1 ? (
                <ChevronRight size={12} strokeWidth={2} className="text-ink-4" />
              ) : null}
            </Fragment>
          ))}
        </div>
      </motion.div>

    </section>
  );
}
