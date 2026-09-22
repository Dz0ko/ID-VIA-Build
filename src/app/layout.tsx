import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CookieNotice } from "@/components/CookieNotice";
import { WhopPixel } from "@/components/WhopPixel";

// Self-hosted variable fonts (no network fetch at dev/build start).
const grotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.ttf",
  variable: "--font-grotesk",
  weight: "300 700",
  display: "swap",
});

const jetbrains = localFont({
  src: "./fonts/JetBrainsMono-Variable.ttf",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

export const metadata: Metadata = {
  title: { default: "IDÆVIA Build", template: "%s · IDÆVIA Build" },
  description:
    "AI software creation platform. Describe it, build it, launch it: websites, SaaS, dashboards and full-stack apps with an AI agent team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${grotesk.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-paper">
        {children}
        <CookieNotice />
        <WhopPixel />
      </body>
    </html>
  );
}
