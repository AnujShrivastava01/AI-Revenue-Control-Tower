"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  FileClock,
  Gauge,
  Brain,
  Settings,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/primitives";
import { EnvironmentPanel } from "./environment-panel";
import { Onboarding } from "./onboarding";
import type { RazorpayModeInfo } from "@/lib/razorpay/client";
import type { AiStatus } from "@/lib/ai/llm";
import logo from "@/app/logo.png";

const NAV = [
  { href: "/command-center", label: "Command Center", icon: Gauge },
  { href: "/investigations", label: "Investigations", icon: Activity },
  { href: "/opportunities", label: "Opportunities", icon: TrendingUp },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/actions", label: "Actions", icon: ClipboardList },
  { href: "/audit", label: "Audit Trail", icon: FileClock },
];

export function Sidebar({
  gateway,
  ai,
  merchantName,
  merchantId,
}: {
  gateway: RazorpayModeInfo;
  ai: AiStatus;
  merchantName: string;
  merchantId: string;
}) {
  const pathname = usePathname();
  const [envOpen, setEnvOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  // First-visit check against localStorage — must run post-mount (client only),
  // so it lives in an effect rather than a lazy useState initializer, which
  // would mismatch the server-rendered HTML.
  React.useEffect(() => {
    if (!window.localStorage.getItem("ct_onboarding_seen")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time flag check, not state sync
      setHelpOpen(true);
    }
  }, []);

  return (
    <>
      <aside className="hidden w-[228px] shrink-0 flex-col border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        <div className="px-5 pb-5 pt-6">
          <Link href="/command-center" className="flex items-start gap-2.5">
            <Image src={logo} alt="" width={30} height={30} className="rounded-md" />
            <div className="text-[12.5px] font-semibold uppercase leading-[1.35] tracking-[0.14em] text-ink">
              Financial
              <br />
              Control
              <br />
              Tower
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2.5" aria-label="Primary">
          <ul className="space-y-px">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-[13px] transition-colors",
                      active
                        ? "bg-[#f0f1f3] font-medium text-ink"
                        : "text-ink-3 hover:bg-raised hover:text-ink",
                    )}
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.75}
                      className={active ? "text-ink" : "text-ink-4"}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-2.5">
          <div className="flex items-center gap-2 px-2.5 py-2">
            <StatusDot tone={gateway.mode === "test" ? "ok" : "warn"} pulse />
            <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-2">
              {gateway.mode === "test" ? "Test mode" : "Demo mode"}
            </span>
          </div>
          <div className="px-2.5 pb-2">
            <div className="eyebrow mb-0.5">Merchant</div>
            <div className="truncate text-[13px] font-medium text-ink">{merchantName}</div>
            <div className="truncate font-mono text-[11px] text-ink-4">{merchantId}</div>
          </div>
          <button
            onClick={() => setEnvOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-[13px] text-ink-3 transition-colors hover:bg-raised hover:text-ink"
          >
            <Settings size={15} strokeWidth={1.75} className="text-ink-4" />
            Environment
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-[13px] text-ink-3 transition-colors hover:bg-raised hover:text-ink"
          >
            <HelpCircle size={15} strokeWidth={1.75} className="text-ink-4" />
            How this works
          </button>
        </div>
      </aside>

      {/* Compact navigation below the desktop breakpoint */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-between border-t border-line bg-surface lg:hidden"
      >
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px]",
                active ? "text-ink" : "text-ink-4",
              )}
            >
              <Icon size={17} strokeWidth={1.75} />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      <EnvironmentPanel
        open={envOpen}
        onClose={() => setEnvOpen(false)}
        gateway={gateway}
        ai={ai}
      />

      <Onboarding
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("ct_onboarding_seen", "1");
          }
        }}
      />
    </>
  );
}
