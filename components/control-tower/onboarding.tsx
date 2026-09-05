"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, Search, GitMerge, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/primitives";

const STAGES = [
  { title: "Observe", detail: "Reads the ledger continuously — webhooks and polling.", icon: Eye },
  { title: "Investigate", detail: "Flags anomalies against the merchant's own baseline.", icon: Search },
  { title: "Decide", detail: "Prices interventions against expected recovery and cost.", icon: GitMerge },
  { title: "Act", detail: "Executes within bounded policy; escalates high-risk actions.", icon: Zap },
  { title: "Verify", detail: "Confirms the outcome against the ledger and updates memory.", icon: CheckCircle2 },
];

const STOPS = [
  { label: "Command Center", detail: "Today's numbers and the things that need your attention first." },
  { label: "Investigations", detail: "Evidence and root cause behind a detected anomaly." },
  { label: "Opportunities", detail: "Recoverable revenue the system found but hasn't acted on." },
  { label: "Actions", detail: "Review, approve or reject a recommended intervention." },
  { label: "Audit Trail", detail: "Full history — detection through execution — for every action." },
];

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[#0b0d10]/40 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="How Financial Control Tower works"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <div className="eyebrow mb-1.5">How this works</div>
                <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">
                  The autonomous financial control loop
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-sm p-1.5 text-ink-4 transition-colors hover:bg-raised hover:text-ink"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <p className="text-[13.5px] leading-relaxed text-ink-3">
                Every screen in this app is a window into one continuous loop. The system
                watches your payment ledger, works out what changed, prices the ways to fix
                it, and asks you before it acts.
              </p>

              <ol className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                {STAGES.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <li
                      key={s.title}
                      className="flex flex-col gap-2 rounded-lg border border-line bg-raised p-3 sm:items-center sm:text-center"
                    >
                      <div className="flex items-center gap-2 sm:flex-col sm:gap-1.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                          <Icon size={15} />
                        </div>
                        <span className="text-[12.5px] font-semibold text-ink">
                          {i + 1}. {s.title}
                        </span>
                      </div>
                      <p className="text-xxs leading-relaxed text-ink-3">{s.detail}</p>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-6 border-t border-line pt-5">
                <div className="eyebrow mb-3">Where to look</div>
                <ul className="space-y-2.5">
                  {STOPS.map((s) => (
                    <li key={s.label} className="flex items-baseline gap-3">
                      <ArrowRight size={13} className="mt-0.5 shrink-0 text-ink-4" />
                      <span className="text-[13px] leading-relaxed text-ink-2">
                        <span className="font-medium text-ink">{s.label}</span> — {s.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line px-6 py-4">
              <span className="text-xxs text-ink-4">
                Reopen anytime from the sidebar — “How this works”.
              </span>
              <Button variant="primary" onClick={onClose}>
                Got it
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
