import { getMode } from "@/lib/razorpay/client";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  const gateway = getMode();

  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col bg-canvas selection:bg-accent-soft selection:text-ink overflow-x-hidden">
        <Navbar mode={gateway.mode} />
        
        <main className="flex-1">
          <Hero />
          
          <div className="relative">
            {/* Subtle separator */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent opacity-50" />
            
            <Features />
          </div>
        </main>
        
        <Footer />
      </div>
    </SmoothScroll>
  );
}
