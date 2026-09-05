"use client";

import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { PlayCircle } from "lucide-react";

export function DemoScroll() {
  return (
    <section id="demo" className="flex flex-col overflow-hidden pb-10 md:pb-20">
      <ContainerScroll
        titleComponent={
          <>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 shadow-sm backdrop-blur-md">
              <PlayCircle size={14} className="text-accent" />
              <span className="text-xs font-medium text-ink-2">Watch it work</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink leading-[1.1]">
              A full incident, resolved <br className="hidden sm:block" />
              <span className="text-accent">without a single manual query.</span>
            </h2>
            <p className="mt-5 max-w-xl mx-auto text-ink-3 text-[15px] leading-relaxed">
              Detection, investigation, approval and recovery — captured end to end from the
              live Control Tower.
            </p>
          </>
        }
      >
        <video
          src="/video.mp4"
          className="mx-auto h-full w-full rounded-2xl object-cover"
          autoPlay
          muted
          loop
          playsInline
          controls
        />
      </ContainerScroll>
    </section>
  );
}
