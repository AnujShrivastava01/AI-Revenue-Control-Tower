"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-hand detail drawer. Focus is moved in on open, restored on close, and
 * Escape closes — a drawer that traps a keyboard user is worse than no drawer.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-[460px]",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#0b0d10]/20 animate-fade-in"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Details"}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full flex-col border-l border-line bg-surface shadow-pop animate-slide-in outline-none",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-xxs text-ink-3">{subtitle}</div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-sm p-1 text-ink-4 transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
