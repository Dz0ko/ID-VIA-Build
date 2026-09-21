"use client";

import dynamic from "next/dynamic";

// Client-only: three.js must never be evaluated during server rendering.
const LiquidBlob = dynamic(() => import("./LiquidBlob").then((m) => m.LiquidBlob), { ssr: false });

export function HeroBlob({ className }: { className?: string }) {
  return <LiquidBlob className={className} />;
}
