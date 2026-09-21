import { z } from "zod";
import { MODEL_TIERS } from "./plans";

export const agentSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(300).default(""),
  systemPrompt: z.string().min(20).max(6000),
  tier: z.enum(MODEL_TIERS).default("standard"),
  multiplier: z.number().min(0.5).max(10).default(2),
  mode: z.enum(["rewrite", "report"]).default("rewrite"),
  isPublic: z.boolean().default(false),
});
