import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import logo from "./logo.png";
import { InstallPrompt } from "@/components/ui/install-prompt";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  axes: ["opsz"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Financial Control Tower",
    template: "%s · Financial Control Tower",
  },
  description:
    "See financial problems before they become losses. An operating layer that observes merchant payments, investigates anomalies, compares interventions and takes bounded, approved action.",
  icons: {
    icon: logo.src,
    apple: logo.src,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
