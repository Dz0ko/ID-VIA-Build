import type { NextConfig } from "next";
import tempoNextjsPlugin from "tempo-sdk/nextjs";

const nextConfig: NextConfig = {
  // Prisma + native deps must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
};

// Tempo canvas instrumentation — no-ops unless TEMPO=true (set by the Tempo app runner).
const withTempo = tempoNextjsPlugin();
export default withTempo(nextConfig as Parameters<typeof withTempo>[0]) as NextConfig;
