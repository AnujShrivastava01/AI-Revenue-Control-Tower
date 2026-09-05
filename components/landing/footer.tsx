"use client";

import Image from "next/image";
import { Github, Linkedin, Globe, FileText } from "lucide-react";
import logo from "@/app/logo.png";

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas px-5 py-12 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <Image src={logo} alt="" width={20} height={20} className="rounded" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink">
              Control Tower
            </span>
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            An intelligent operating layer for modern payment architectures. Observe transactions, detect anomalies, and take automated action based on policy.
          </p>
        </div>

        <div className="max-w-xl text-left md:text-right">
          <div className="inline-flex rounded border border-line-strong bg-raised px-2 py-1 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Environment Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-4">
            Test environment. 10,000 transactions across 42 days of history for a sample
            merchant. Gateway calls run against Razorpay test mode or a clearly-labelled
            local adapter. No real money moves and no real customer data is present.
          </p>
        </div>
      </div>

      {/* Author / project links */}
      <div className="max-w-7xl mx-auto mt-10 pt-8 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-4 mb-1.5">Built by</div>
          <div className="text-sm font-semibold text-ink">Anuj Shrivastava</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://www.linkedin.com/in/anujshrivastava1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
          >
            <Linkedin size={13} /> LinkedIn
          </a>
          <a
            href="https://www.anujshrivastava.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
          >
            <Globe size={13} /> Portfolio
          </a>
          <a
            href="https://github.com/AnujShrivastava01/AI-Revenue-Control-Tower"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
          >
            <Github size={13} /> Repository
          </a>
          <a
            href="/api/docs/report"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
          >
            <FileText size={13} /> Documentation (PDF)
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-line flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-xs text-ink-4">
          © {new Date().getFullYear()} Razorpay Buildathon — Open Track · Anuj Shrivastava
        </span>
        <div className="flex gap-4">
          <a href="#" className="text-xs text-ink-4 hover:text-ink transition-colors">Privacy</a>
          <a href="#" className="text-xs text-ink-4 hover:text-ink transition-colors">Terms</a>
        </div>
      </div>
    </footer>
  );
}
