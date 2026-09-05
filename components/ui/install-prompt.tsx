"use client";

import Image from "next/image";
import * as React from "react";
import { Download, X } from "lucide-react";
import logo from "@/app/logo.png";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent || dismissed) return null;

  async function install() {
    await installEvent?.prompt();
    const choice = await installEvent?.userChoice;
    if (choice?.outcome === "accepted") setInstallEvent(null);
  }

  return (
    <aside className="fixed bottom-5 left-5 z-50 flex w-[min(360px,calc(100vw-2.5rem))] items-center gap-3 rounded-lg border border-line-strong bg-surface p-3 shadow-pop">
      <Image src={logo} alt="" width={42} height={42} className="shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Install Control Tower</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">Keep your financial operations workspace close at hand.</p>
      </div>
      <button
        type="button"
        onClick={install}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-ink px-2.5 text-xs font-medium text-surface transition-colors hover:bg-ink-2"
      >
        <Download size={13} />
        Install
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={() => setDismissed(true)}
        className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-3 shadow-sm hover:text-ink"
      >
        <X size={13} />
      </button>
    </aside>
  );
}
