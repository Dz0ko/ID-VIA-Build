import { z } from "zod";

export const agentSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(300).default(""),
  systemPrompt: z.string().min(20).max(6000),
  tier: z.enum(["fast", "standard", "advanced", "premium"]).default("standard"),
  multiplier: z.number().min(0.5).max(10).default(2),
  mode: z.enum(["rewrite", "report"]).default("rewrite"),
  isPublic: z.boolean().default(false),
});
