"use client";

import * as React from "react";
import { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = (): [number, number] => (isMobile ? [0.82, 1] : [1.05, 1]);

  const rotate = useTransform(scrollYProgress, [0, 0.5], [16, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 0.5], [0, -60]);

  return (
    <div
      className="flex min-h-[70rem] items-center justify-center relative py-10 md:py-20"
      ref={containerRef}
    >
      <div className="w-full relative" style={{ perspective: "1200px" }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
}

function Header({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent: string | React.ReactNode;
}) {
  return (
    <motion.div style={{ translateY: translate }} className="max-w-4xl mx-auto text-center px-5">
      {titleComponent}
    </motion.div>
  );
}

function Card({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="max-w-5xl -mt-8 md:-mt-4 mx-auto h-[22rem] sm:h-[28rem] md:h-[38rem] w-full border-4 border-ink/80 p-2 md:p-4 bg-ink rounded-[24px] shadow-2xl"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-canvas">{children}</div>
    </motion.div>
  );
}
