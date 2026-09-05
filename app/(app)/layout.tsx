import { Suspense } from "react";
import { Sidebar } from "@/components/control-tower/sidebar";
import { TopBar } from "@/components/control-tower/topbar";
import { SessionProvider } from "@/components/state/session";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { getMode } from "@/lib/razorpay/client";
import { getAiStatus } from "@/lib/ai/llm";
import { MERCHANT } from "@/lib/demo/config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const gateway = getMode();
  const ai = getAiStatus();

  return (
    <SessionProvider>
      <SmoothScroll>
        <div className="flex min-h-screen">
          <Sidebar
            gateway={gateway}
            ai={ai}
            merchantName={MERCHANT.name}
            merchantId={MERCHANT.id}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={<div className="h-[52px] shrink-0 border-b border-line bg-surface" />}>
              <TopBar
                gateway={gateway}
                ai={ai}
                merchant={{
                  name: MERCHANT.name,
                  id: MERCHANT.id,
                  mcc: MERCHANT.mcc,
                  legalName: MERCHANT.legalName,
                }}
              />
            </Suspense>
            <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
          </div>
        </div>
      </SmoothScroll>
    </SessionProvider>
  );
}
