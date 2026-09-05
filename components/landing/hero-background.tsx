"use client";

import { motion } from "framer-motion";
import { CreditCard, IndianRupee, Smartphone, Wifi } from "lucide-react";

const ICONS = [
  { Icon: IndianRupee, top: "18%", left: "10%", delay: 0, duration: 7 },
  { Icon: CreditCard, top: "68%", left: "14%", delay: 1.2, duration: 8.5 },
  { Icon: Smartphone, top: "24%", left: "88%", delay: 0.6, duration: 7.5 },
  { Icon: Wifi, top: "72%", left: "86%", delay: 1.8, duration: 9 },
];

const BLUE = "#1a4fd6";

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="hero-dot-field absolute inset-[-12%]"
        animate={{ backgroundPosition: ["0 0", "30px 18px", "0 0"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="hero-soft-light absolute inset-0" />

      {/* Faint payment signals keep the technical theme grounded in the product. */}
      {ICONS.map(({ Icon, top, left, delay, duration }, i) => (
        <motion.div
          key={i}
          className="absolute hidden md:block"
          style={{ top, left, color: BLUE }}
          animate={{ y: [0, -10, 0], opacity: [0.1, 0.24, 0.1] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        >
          <Icon size={34} strokeWidth={1.4} />
        </motion.div>
      ))}
    </div>
  );
}
