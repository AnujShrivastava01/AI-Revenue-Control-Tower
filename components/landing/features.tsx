"use client";

import { motion } from "framer-motion";
import { Eye, Search, GitMerge, Zap, CheckCircle2, ArrowRight, ArrowDown } from "lucide-react";

const STEPS = [
  {
    id: "observe",
    title: "Observe",
    description: "Continuously reads the payment ledger, ingesting webhooks and polling API endpoints to build a real-time state of your transaction flow.",
    icon: Eye,
  },
  {
    id: "investigate",
    title: "Investigate",
    description: "Detects anomalies against your merchant's unique baseline. Opens investigation timelines and collects evidence without human intervention.",
    icon: Search,
  },
  {
    id: "decide",
    title: "Decide",
    description: "Prices alternative interventions against each other on expected recovery, expected cost, and net benefit. Computes the optimal path.",
    icon: GitMerge,
  },
  {
    id: "act",
    title: "Act",
    description: "Executes the selected action within bounded, deterministic policy engines. High-risk actions are escalated for human approval.",
    icon: Zap,
  },
  {
    id: "verify",
    title: "Verify",
    description: "Validates the outcome of actions against the ledger, closing the loop and building memory to improve future anomaly detection.",
    icon: CheckCircle2,
  },
];

export function Features() {
  return (
    <section id="how-it-works" className="py-24 px-5 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-16 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-3 mb-4">How it Works</h2>
        <p className="text-3xl sm:text-4xl font-bold tracking-tight text-ink max-w-2xl mx-auto leading-tight">
          The autonomous <span className="text-accent">financial control loop</span>
        </p>
      </div>

      {/* Flow diagram: node + arrow chain */}
      <div className="mb-24 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex flex-col md:flex-row items-center w-full md:w-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex flex-col items-center gap-3 shrink-0"
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-card">
                  <Icon size={22} className="text-accent" />
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-mono font-semibold text-surface">
                    {i + 1}
                  </span>
                </div>
                <span className="text-[13px] font-semibold text-ink">{step.title}</span>
              </motion.div>

              {i < STEPS.length - 1 && (
                <>
                  <ArrowRight size={18} className="hidden md:block mx-3 shrink-0 text-ink-4" />
                  <ArrowDown size={18} className="block md:hidden my-2 shrink-0 text-ink-4" />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Step-by-step demonstration */}
      <div className="relative">
        <div className="absolute left-[27px] top-4 bottom-4 w-px bg-line md:left-1/2 md:-ml-px hidden sm:block" />

        <div className="space-y-16 sm:space-y-24">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isEven = i % 2 === 0;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
                className={`relative flex flex-col sm:flex-row items-start gap-8 md:gap-16 ${
                  isEven ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                <div className="hidden sm:flex absolute left-[11px] md:left-1/2 md:-ml-[17px] top-1 items-center justify-center w-9 h-9 rounded-full border-4 border-canvas bg-surface shadow-sm z-10 text-ink">
                  <span className="font-mono text-xs font-semibold tnum">0{i + 1}</span>
                </div>

                <div className={`flex-1 w-full ${isEven ? "md:text-right" : "md:text-left"}`}>
                  <div className={`flex items-center gap-3 mb-4 ${isEven ? "md:justify-end" : "md:justify-start"}`}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface shadow-card sm:hidden">
                       <span className="font-mono text-xs font-semibold tnum">0{i + 1}</span>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent sm:hidden md:flex">
                      <Icon size={18} />
                    </div>
                    <h3 className="text-xl font-semibold text-ink">{step.title}</h3>
                  </div>

                  <p className="text-ink-3 leading-relaxed text-[15px]">
                    {step.description}
                  </p>
                </div>

                <div className="hidden md:block flex-1" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
